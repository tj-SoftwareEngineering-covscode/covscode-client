import { ClientRepo } from "../entity/clientRepo";
import { RepoEditor } from "../editor/repoEditor";
import { NodeCreateAction } from '../action/file/nodeCreateAction';
import { NodeDeleteAction } from '../action/file/nodeDeleteAction';
import { NodeRenameAction } from '../action/file/nodeRenameAction';
import { Disposable, 
        FileCreateEvent, 
        FileDeleteEvent, 
        FileWillDeleteEvent, 
        FileRenameEvent,
        TextDocument, 
        TextDocumentChangeEvent, 
        TextEditorSelectionChangeEvent, 
        Uri, 
        window, 
        workspace, 
        TabInputText,
        RelativePattern,
        FileType,
} from "vscode";
import { basename } from 'path';
import { Mutex } from 'async-mutex';
import * as path from 'path';
import { DocManager } from '../manager/docManager';

/**
 * WorkspaceWatcher 类负责监听工作区内的文件和文件夹变化
 * 处理文件的创建、删除、重命名等操作
 */
export class WorkspaceWatcher{
      // 客户端仓库实例，用于处理仓库相关操作
      private clientRepo: ClientRepo;
      // 仓库编辑器实例，用于处理编辑器相关操作
      private repoEditor: RepoEditor;
      // 存储所有监听器的数组
      private listeners: Disposable[] = [];
      // 存储路径是否为文件的标志
      private isFileMap: Map<string, boolean> = new Map();
      // 存储文件夹包含的文件列表
      private folderFilesMap: Map<string, string[]> = new Map();
      // 互斥锁，用于确保操作的原子性
      private mutex = new Mutex();

      constructor(clientRepo: ClientRepo, repoEditor: RepoEditor){
        // 初始化客户端仓库实例
        this.clientRepo = clientRepo;       
        // 初始化仓库编辑器实例
        this.repoEditor = repoEditor;
      }

      /**
       * 处理文件或文件夹创建事件
       */
      private onNodeCreate = async({files}: FileCreateEvent) =>{
        // 获取创建的文件或文件夹
        const fileOrDir = files[0];
        // 获取相对路径
        const relativePath = this.repoEditor.getRelativePath(fileOrDir.fsPath);
        // 获取文件名
        const fileName = basename(fileOrDir.fsPath);
        // 获取文件状态信息
        const stats = await workspace.fs.stat(fileOrDir); 
        // 判断是否为文件
        const isFile = stats.type === 1;
        console.log('创建......');
        await this.mutex.runExclusive(async() => {
           // 创建节点动作
          let nodeCreateAction = new NodeCreateAction(
            this.clientRepo.getUser(), 
            relativePath, 
            fileName, 
            isFile, 
            ''
          );
          // 获取WebSocket连接
          let websocketConnection = this.clientRepo.getWebsocketConnection();
          // 发送创建动作
          websocketConnection.sendData(nodeCreateAction);
        });  
      };


      // // 设置文件或文件夹是否为文件
      // private async setIsDir(path: string) {
      //   const stats = await workspace.fs.stat(Uri.file(path));
      //   const isFile = stats.type === 1;  // 1 表示文件
      //   this.isFileMap.set(path, isFile);
      // }


      /**
       * 处理文件或文件夹即将删除事件
       */
      private onWillDeleteNode = (event: FileWillDeleteEvent) => {
        // 获取要删除的文件或文件夹
        const fileOrDir = event.files[0];
        // 等待删除操作完成
        event.waitUntil(this.handleNodeDelete(fileOrDir));
      };

      /**
       * 处理节点删除的具体逻辑
       */
      private async handleNodeDelete(fileOrDir: Uri) {
        try {
            // 获取文件状态信息
            const stats = await workspace.fs.stat(fileOrDir);
            // 判断是否为文件
            const isFile = stats.type === 1;
            // 保存文件类型信息
            this.isFileMap.set(fileOrDir.fsPath, isFile);

            if (!isFile) {
                // 如果是文件夹，收集所有文件路径
                const files: string[] = [];
                // 递归获取所有文件
                await this.getAllFiles(fileOrDir.fsPath, files);
                // 按路径长度排序，确保先处理深层文件
                files.sort((a, b) => b.length - a.length);
                // 保存文件列表
                this.folderFilesMap.set(fileOrDir.fsPath, files);

                if (files) {
                  for (const filePath of files) {
                    // 获取相对路径
                    const path = this.repoEditor.getRelativePath(filePath);
                    // 获取目标文件
                    let targetFile = this.clientRepo.getFileMap().get(path); 
                    if(targetFile){
                      let doc=DocManager.getDoc(targetFile!);
                      if(doc){
                        console.log(doc.data.content);
                        let setVersion = () => {
                          targetFile.setVersionMap(doc?.version!, true);
                        };
                        let op={ p: ['content', 0], sd: doc.data.content };
                        doc.submitOp(op,undefined,setVersion);
                      }   
                    } 
                  }
                }
            }
            else if(isFile){
              const path = this.repoEditor.getRelativePath(fileOrDir.fsPath);
              console.log(path);
                let targetFile = this.clientRepo.getFileMap().get(path); 
                if(targetFile){
                  let doc=DocManager.getDoc(targetFile!);
                  if(doc){
                    console.log(doc.data.content);
                    let setVersion = () => {
                      targetFile.setVersionMap(doc?.version!, true);
                    };
                    let op={ p: ['content', 0], sd: doc.data.content };
                    doc.submitOp(op,undefined,setVersion);
                  }   
              } 
            }
        } catch (err) {
            console.error('处理删除操作错误:', err);
        }
      };

      /**
       * 文件或文件夹删除事件
       */
      private onNodeDelete = async({files}: FileDeleteEvent) => {
        // 获取要删除的文件或文件夹
        const fileOrDir = files[0];
        
        // 获取相对路径
        const relativePath = this.repoEditor.getRelativePath(fileOrDir.fsPath);
        
        // 获取文件名
        const fileName = basename(fileOrDir.fsPath);
        
        // 获取文件类型标志
        const isFile = this.isFileMap.get(fileOrDir.fsPath);

        await this.mutex.runExclusive(async() => {
            if (!isFile) {
                // 获取文件夹中的文件列表
                const folderFiles = this.folderFilesMap.get(fileOrDir.fsPath);
                
                if (folderFiles) {
                    for (const filePath of folderFiles) {
                        // 获取文件的相对路径
                        const relPath = this.repoEditor.getRelativePath(filePath);
                        console.log('删除文件:', relPath);
                        
                        // 删除文件
                        await this.clientRepo.onLocalNodeDelete(relPath, basename(relPath), true);
                    }
                    // 从Map中删除文件列表
                    this.folderFilesMap.delete(fileOrDir.fsPath);
                }
                
                // 创建文件夹删除动作
                let folderDeleteAction = new NodeDeleteAction(
                    this.clientRepo.getUser(),
                    relativePath,
                    fileName,
                    false  // 这是文件夹
                );
                
                // 获取WebSocket连接
                let websocketConnection = this.clientRepo.getWebsocketConnection();
                
                // 发送删除动作
                websocketConnection.sendData(folderDeleteAction);
            } else {
                // 删除单个文件
                await this.clientRepo.onLocalNodeDelete(relativePath, fileName, true);
            }
        });

        // 从Map中删除文件类型标志
        this.isFileMap.delete(fileOrDir.fsPath);
      };
      
      /**
       * 递归获取文件夹下所有文件的路径
       */
      private async getAllFiles(dirPath: string, files: string[]) {
        try {
            // 创建目录URI
            const dirUri = Uri.file(dirPath);
            
            // 读取目录内容
            const entries = await workspace.fs.readDirectory(dirUri);
            
            // 遍历目录中的所有条目
            for (const [name, type] of entries) {
                // 构建完整路径
                const fullPath = path.join(dirPath, name);
                console.log('处理路径:', fullPath, 'type:', type);
                
                if (type === FileType.File) {
                    // 如果是文件，添加到文件列表
                    files.push(fullPath);
                } else if (type === FileType.Directory) {
                    try {
                        // 如果是目录，递归处理
                        await this.getAllFiles(fullPath, files);
                    } catch (err) {
                        console.error('递归处理子目录错误:', err);
                    }
                }
            }
        } catch (err) {
            console.error('读取目录错误:', err, '路径:', dirPath);
        }
      }

      /**
       * 文件或文件夹重命名事件
       */
      private onNodeRename = async({ files }: FileRenameEvent) => {
        // 获取旧的和新的URI
        const { oldUri, newUri } = files[0];
        
        // 获取旧路径
        const oldPath = this.repoEditor.getRelativePath(oldUri.fsPath);
        
        // 获取原文件名
        const oldName = basename(oldUri.fsPath);
        
        // 获取新文件名
        const newName = basename(newUri.fsPath);
        
        // 获取文件状态信息
        const stats = await workspace.fs.stat(newUri);
        
        // 判断是否为文件
        const isFile = stats.type === 1;
        
        console.log('重命名......');
        
        await this.mutex.runExclusive(async() => {
            // 创建重命名动作
            let nodeRenameAction = new NodeRenameAction(
                this.clientRepo.getUser(),
                oldPath,
                oldName,
                isFile,
                newName
            );
            
            // 获取WebSocket连接
            let websocketConnection = this.clientRepo.getWebsocketConnection();
            
            // 发送重命名动作
            websocketConnection.sendData(nodeRenameAction);
        });
      };

      /**
       * 文件打开事件
       */
      private onFileOpen = async(textDocument: TextDocument) => {
        // 检查是否为文件类型的文档
        if (textDocument.uri.scheme !== "file") {
          return;
        }
        
        console.log('打开......');
        
        // 处理本地文件打开
        await this.clientRepo.onLocalFileOpen(textDocument);
        
        // 更新光标装饰器
        await this.repoEditor.updateCursorDecorators();
      };

      /**
       * 文件关闭事件
       */
      private onFileClose = async(textDocument: TextDocument) => {
        // 检查是否为文件类型的文档
        if (textDocument.uri.scheme !== "file") {
          return;
        }
        
        console.log('关闭......');
        
        // 处理本地文件关闭
        await this.clientRepo.onLocalFileClose(this.repoEditor.getRelativePath(textDocument.uri.fsPath));
        
        // 更新光标装饰器
        await this.repoEditor.updateCursorDecorators();
      };

      /**
       * 文件内容变化事件
       */
      private onChangeTextDocument = async(textDocumentChangeEvent: TextDocumentChangeEvent) => {
        // 检查是否为文件类型的文档
        if (textDocumentChangeEvent.document.uri.scheme !== "file") {
          return;
        }
        
        console.log('内容变化......');
        
        // 获取当前活动的编辑器
        const activeEditor = window.activeTextEditor;
        
        if (activeEditor) {
            // 获取当前光标位置
            const position = activeEditor.selection.active;
            
            if (activeEditor.document.uri.scheme === "file") {
                // 更新光标位置
                this.clientRepo.onLocalCursorMove(
                    this.repoEditor.getRelativePath(activeEditor.document.uri.fsPath),
                    activeEditor.document.fileName,
                    activeEditor.document.offsetAt(position)
                );
            }
        }
        
        // 处理文件内容变化
        await this.clientRepo.onLocalFileChange(textDocumentChangeEvent);
      };

      /**
       * 文本编辑器选择变化事件
       */
      private onChangeSeletion = async ({ textEditor, selections }: TextEditorSelectionChangeEvent) => {
        // 检查是否为文件类型的文档
        if (textEditor.document.uri.scheme !== "file") {
          return;
        }
        
        // 更新光标位置
        await this.clientRepo.onLocalCursorMove(
            this.repoEditor.getRelativePath(textEditor.document.uri.fsPath),
            textEditor.document.fileName,
            textEditor.document.offsetAt(selections[0].active)
        );
      };

      /**
       * 可见文本编辑器变化事件
       */
      private onChangeVisibleTextEditors = async () => {
        // 更新光标装饰器
        await this.repoEditor.updateCursorDecorators();
      };

      /**
       * 设置所有监听器
       */
      async setListeners(){
        // 移除现有的监听器
        this.removeListeners();
        
        // 获取所有标签组
        const tabGroups = window.tabGroups;
        
        // 收集所有需要关闭的标签页
        const tabsToClose = tabGroups.all.flatMap(group => 
            group.tabs.filter(tab => tab.input instanceof TabInputText)
        );
        
        // 关闭所有标签页
        if (tabsToClose.length > 0) {
            await window.tabGroups.close(tabsToClose);
        }

        // 设置各种事件的监听器
        workspace.onDidOpenTextDocument(this.onFileOpen, null, this.listeners);
        workspace.onDidCloseTextDocument(this.onFileClose, null, this.listeners);
        workspace.onDidChangeTextDocument(this.onChangeTextDocument, null, this.listeners);
        workspace.onDidCreateFiles(this.onNodeCreate, null, this.listeners);
        workspace.onDidDeleteFiles(this.onNodeDelete, null, this.listeners);
        workspace.onDidRenameFiles(this.onNodeRename, null, this.listeners);
        workspace.onWillDeleteFiles(this.onWillDeleteNode, null, this.listeners);
        window.onDidChangeTextEditorSelection(this.onChangeSeletion, null, this.listeners);
        window.onDidChangeVisibleTextEditors(this.onChangeVisibleTextEditors, null, this.listeners);
      }

      /**
       * 移除所有监听器
       */
      removeListeners(){
        // 遍历并销毁所有监听器
        this.listeners.forEach((listener) => listener.dispose());
        
        // 清空监听器数组
        this.listeners = [];
      }
}