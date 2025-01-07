import { Range, TextDocument, workspace, WorkspaceEdit } from 'vscode';
import { readFile, writeFile } from 'fs/promises';
import { RepoEditor } from './repoEditor';
import { basename } from 'path';

/**
 * FileEditor 类负责处理文件的编辑操作
 * 包括文件的读取、写入和内容更新等功能
 */
export class FileEditor {
    // 文件相对于工作区的路径
    private relativePath: string;
    
    // 文件名
    private fileName: string;
    
    // 文件的绝对路径
    private absolutePath: string;
    
    // 文件是否已打开
    private isOpened: boolean;
    
    // 文件的文档对象，如果文件未打开则为null
    private textDocument: TextDocument | null;
    
    // 仓库编辑器实例
    private repoEditor: RepoEditor;

    /**
     * 构造函数
     * @param repoEditor 仓库编辑器实例
     * @param isOpened 文件是否已打开
     * @param documentOrPath 文档对象或文件路径
     */
    constructor(repoEditor: RepoEditor, isOpened: boolean, documentOrPath: TextDocument | string) {
        if(isOpened) {
            // 如果文件已打开，使用TextDocument初始化
            this.textDocument = documentOrPath as TextDocument;
            
            // 获取文件的相对路径
            this.relativePath = repoEditor.getRelativePath(this.textDocument.uri.fsPath);
            
            // 获取文件名
            this.fileName = basename(this.textDocument.fileName);
            
            // 获取文件的绝对路径
            this.absolutePath = this.textDocument.uri.fsPath;
        } 
        else {
            // 如果文件未打开，使用路径初始化
            this.textDocument = null;
            
            // 保存相对路径
            this.relativePath = documentOrPath as string;
            
            // 获取文件名
            this.fileName = basename(this.relativePath);
            
            // 获取文件的绝对路径
            this.absolutePath = repoEditor.getAbsolutePath(this.relativePath);
        }
        
        // 保存文件打开状态
        this.isOpened = isOpened;
        
        // 保存仓库编辑器实例
        this.repoEditor = repoEditor; 
    }

    /**
     * 获取文件的相对路径
     */
    getRelativePath(){
        return this.relativePath;
    }

    /**
     * 获取文件的绝对路径
     */
    getAbsolutePath(){
        return this.absolutePath;
    }

    /**
     * 获取文件名
     */
    getFileName(){
        return this.fileName;
    }

    /**
     * 获取文件是否打开的状态
     */
    getIsOpened(){
        return this.isOpened;
    }

    /**
     * 获取文件的当前内容
     * 如果文件已打开，直接获取文档内容
     * 如果文件未打开，从文件系统读取内容
     */
    getCurrentContent(){
        if(this.isOpened){
            // 如果文件已打开，直接获取文档内容
            return this.textDocument!.getText();
        }
        else{
            // 如果文件未打开，从文件系统读取内容
            return readFile(this.absolutePath, { encoding: 'utf-8' });
        }
    }

    /**
     * 获取文件的文档对象
     * 如果文件未打开则返回null
     */
    getTextDocument(){
        if(this.isOpened){
            // 如果文件已打开，返回文档对象
            return this.textDocument;
        }
        else{
            // 如果文件未打开，返回null
            return null;
        }
    }

    /**
     * 重写文件内容
     * @param content 新的文件内容
     */
    async onRewrite(content: string): Promise<void> {
        if (this.isOpened) {
            // 如果文件已打开，使用工作区编辑
            const textDocument = this.textDocument!;
            
            // 获取文档的最后位置
            const endPosition = textDocument.lineAt(textDocument.lineCount - 1).range.end;
            
            // 创建一个新的 WorkspaceEdit 对象，用于批量应用编辑操作
            const edit = new WorkspaceEdit();
            
            // 在整个文件范围内替换内容
            edit.replace(
                textDocument.uri,
                new Range(textDocument.positionAt(0), endPosition),
                content
            );
            
            // 应用编辑操作，将新的内容写入打开的文件
            await workspace.applyEdit(edit);
            
            // 更新光标装饰器
            this.repoEditor.updateCursorDecorators();
        } else {
            // 如果文件未打开，直接写入文件系统
            await writeFile(this.absolutePath, content);
        }
    }
}