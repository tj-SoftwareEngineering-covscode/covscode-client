import { ClientUser } from "./clientUser"; // 引入 ClientUser 类，用于管理客户端用户信息
import { ClientRepo } from "./clientRepo"; // 引入 ClientRepo 类，用于管理客户端存储库
import { BaseAction } from "../action/baseAction"; // 引入 BaseAction 类，用于定义基础动作
import { Mutex } from "async-mutex"; // 引入 Mutex 类，用于实现异步互斥锁
import { TextDocumentChangeEvent } from "vscode"; // 引入 TextDocumentChangeEvent 类型，用于处理 VSCode 文本文档变化事件
import { DocManager } from "../manager/docManager"; // 引入 DocManager 类，用于管理文档
import * as vscode from "vscode"; // 引入 vscode 模块，用于访问 VSCode 的 API
import { FileEditor } from "../editor/fileEditor"; // 引入 FileEditor 类，用于管理文件编辑器

/**
 * ClientFile 类，用于管理客户端文件
 */
export class ClientFile {
    // 存储打开文件的用户，使用 siteId 作为键
    private openUsers: Map<string, ClientUser> = new Map();
    // 客户端存储库
    private clientRepo!: ClientRepo;
    // 文件编辑器
    private fileEditor!: FileEditor;
    // 文件内容
    private content: string = '';
    // 文件版本
    private version: number;
    // 版本映射，用于记录版本是否来自本地
    private versionMap: Map<number, boolean> = new Map();
    // 标记文件内容是否来自本地
    private isFromLocal: boolean;
    // 标记文件是否正在刷新
    private isFreshing: boolean;
    // 远程行映射，用于记录远程行号和本地行号的对应关系
    public remoteRowMap: Map<number, number> = new Map();

    // 互斥锁，用于保证操作的原子性
    private mutex = new Mutex();

    /**
     * 构造函数
     * @param clientRepo 客户端存储库
     * @param fileEditor 文件编辑器
     */
    constructor(clientRepo: ClientRepo, fileEditor: FileEditor) {
        this.clientRepo = clientRepo;
        this.fileEditor = fileEditor;
        this.version = 0;
        this.isFromLocal = true;
        this.isFreshing = false;
    }

    /**
     * 获取客户端存储库
     */
    public getClientRepo() {
        return this.clientRepo;
    }

    /**
     * 获取文件内容
     */
    public getContent() {
        return this.content;
    }

    /**
     * 从文件编辑器获取当前文件内容
     */
    public getFileContent() {
        return this.fileEditor.getCurrentContent();
    }

    /**
     * 获取文件的相对路径
     */
    public getRelativePath() {
        return this.fileEditor.getRelativePath();
    }

    /**
     * 获取文件名
     */
    public getFileName() {
        return this.fileEditor.getFileName();
    }

    /**
     * 设置版本映射
     * @param version 版本号
     * @param isFromLocal 是否来自本地
     */
    public setVersionMap(version: number, isFromLocal: boolean) {
        this.versionMap.set(version, isFromLocal);
    }

    /**
     * 检查文件是否已打开
     */
    public getIsOpened() {
        return this.fileEditor.getIsOpened();
    }

    /**
     * 设置文件版本
     * @param version 版本号
     */
    public setVersion(version: number) {
        this.version = version;
    }

    /**
     * 重置文件编辑器
     * @param fileEditor 新的文件编辑器
     */
    public resetFileEditor(fileEditor: FileEditor) {
        this.fileEditor = fileEditor;
    }

    /**
     * 添加打开文件的用户
     * @param user 客户端用户
     */
    public addOpenUser(user: ClientUser) {
        this.openUsers.set(user.siteId!, user);
    }

    /**
     * 移除打开文件的用户
     * @param user 客户端用户
     */
    public removeOpenUser(user: ClientUser) {
        this.openUsers.delete(user.siteId!);
    }

    /**
     * 处理文件写入事件
     * @param newContent 新的文件内容
     */
    public async onWrite(newContent: string) {
        this.fileEditor.onRewrite(newContent);
    }

    /**
     * 执行动作
     * @param action 基础动作
     */
    public async excute(action: BaseAction) {
        // 使用互斥锁保证动作执行的原子性
        await this.mutex.runExclusive(async () => {
            await this.classifyAction(action);
        });
    }

    /**
     * 对动作进行分类处理
     * @param action 基础动作
     */
    private async classifyAction(action: BaseAction) {
        // TODO: 实现动作分类处理逻辑
    }

    /**
     * 获取删除的部分
     * @param originalText 原始文本
     * @param modifiedText 修改后的文本
     */
    public static getDeletePart(originalText: string, modifiedText: string) {
        let deletion = "";
        let originalIndex = 0;
        let modifiedIndex = 0;
        let deletionStart = -1;

        // 遍历文本，查找删除部分
        while (originalIndex < originalText.length && modifiedIndex < modifiedText.length) {
            if (originalText[originalIndex] !== modifiedText[modifiedIndex]) {
                if (deletionStart === -1) {
                    deletionStart = originalIndex;
                }
                originalIndex++;
            } else {
                if (deletionStart !== -1) {
                    deletion = originalText.substring(deletionStart, originalIndex);
                    break;
                }
                originalIndex++;
                // 跳过原始文本和修改文本中的相同字符（这里原代码有误，modifiedIndex 应该递增）
                modifiedIndex++;
            }
        }

        // 如果未找到删除部分且存在删除起始位置，则删除从起始位置到末尾的部分
        if (deletion === "" && deletionStart !== -1) {
            deletion = originalText.substring(deletionStart);
        }

        return deletion;
    }

    /**
     * 处理文件内容更新事件
     * @param textDocumentChangeEvent 文本文档变化事件
     */
    public async fileContentUpdate(textDocumentChangeEvent: TextDocumentChangeEvent) {
        // 使用互斥锁保证更新操作的原子性
        await this.mutex.runExclusive(async () => {
            if (textDocumentChangeEvent.contentChanges.length === 0) {
                return;
            }

            let doc = DocManager.getDoc(this);

            // 如果找不到对应的文档，则输出日志
            if (doc === undefined || doc === null) {
                console.log(this.getFileName() + '文件没有doc');
                return;
            }

            // 如果当前文件内容与文档内容一致，则直接更新内部内容
            if (this.getFileContent() === doc?.data.content) {
                this.content = textDocumentChangeEvent.document.getText();
                return;
            }

            // 构建操作列表
            let op: { p: [string, number]; sd?: string; si?: string }[] = [];
            textDocumentChangeEvent.contentChanges.forEach((change) => {
                let changeText = change.text;
                let offset = change.rangeOffset;

                // 处理删除操作
                if (changeText === "") {
                    let oldText = this.content;
                    let deletedPart = oldText.substring(offset, offset + change.rangeLength);
                    op.push({ p: ["content", offset], sd: deletedPart });
                } else {
                    // 处理插入操作
                    if (change.rangeLength === 0) {
                        const editor = vscode.window.activeTextEditor;
                        let position;
                        if (editor) {
                            position = editor.selection.active;
                        }
                        offset = textDocumentChangeEvent.document.offsetAt(position!);
                        op.push({ p: ["content", offset], si: changeText });
                    } else {
                        // 处理替换操作
                        let previousText = this.content.substring(offset, offset + change.rangeLength);
                        op.push({ p: ["content", offset], sd: previousText });
                        op.push({ p: ["content", offset], si: changeText });
                    }
                }
            });

            // 更新内部内容
            this.content = textDocumentChangeEvent.document.getText();

            // 设置版本映射的函数
            let setVersion = () =>{
                this.setVersionMap(doc?.version!, true); // 设置版本映射
            };

            if (this.getFileContent() !== doc?.data.content && !this.isFreshing) {
                doc?.submitOp(op, { source: this.clientRepo.getUserId() }, setVersion); // 提交操作，并设置 source 参数为当前用户的ID
            } else {
                this.isFreshing = false; // 重置刷新标志
            }
        })
    }
}