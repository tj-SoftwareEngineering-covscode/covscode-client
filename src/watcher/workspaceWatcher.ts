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

export class WorkspaceWatcher{
      private clientRepo: ClientRepo;
      private repoEditor: RepoEditor;
      private listeners: Disposable[] = [];
      // 存储路径是否为文件的标志
      private isFileMap: Map<string, boolean> = new Map();
      // 存储文件夹包含的文件列表
      private folderFilesMap: Map<string, string[]> = new Map();
      private mutex = new Mutex();

      constructor(clientRepo: ClientRepo, repoEditor: RepoEditor){
        this.clientRepo = clientRepo;       
        this.repoEditor = repoEditor;
      }

      // 文件或文件夹创建事件
      private onNodeCreate = async({files}: FileCreateEvent) =>{
        const fileOrDir = files[0];
        // 获取相对路径
        const relativePath = this.repoEditor.getRelativePath(fileOrDir.fsPath);
        // 获取文件名
        const fileName = basename(fileOrDir.fsPath);
        // 判断是文件还是文件夹
        // 返回文件或文件夹的详细信息，包括类型，大小，创建时间，修改时间等
        const stats = await workspace.fs.stat(fileOrDir); 
        const isFile = stats.type === 1;
        console.log('创建......');
        await this.mutex.runExclusive(async() => {
           // 创建动作
          let nodeCreateAction = new NodeCreateAction(
            this.clientRepo.getUser(), 
            relativePath, 
            fileName, 
            isFile, 
            ''
          );
          let websocketConnection = this.clientRepo.getWebsocketConnection();
          websocketConnection.sendData(nodeCreateAction);
        });  
      };


      // // 设置文件或文件夹是否为文件
      // private async setIsDir(path: string) {
      //   const stats = await workspace.fs.stat(Uri.file(path));
      //   const isFile = stats.type === 1;  // 1 表示文件
      //   this.isFileMap.set(path, isFile);
      // }


      // 处理文件或文件夹即将删除事件
      private onWillDeleteNode = (event: FileWillDeleteEvent) => {
        const fileOrDir = event.files[0];
        event.waitUntil(this.handleNodeDelete(fileOrDir));
      };

      // 处理节点删除的具体逻辑
      private async handleNodeDelete(fileOrDir: Uri) {
        try {
            // 判断是文件还是文件夹并保存状态
            const stats = await workspace.fs.stat(fileOrDir);
            const isFile = stats.type === 1;
            this.isFileMap.set(fileOrDir.fsPath, isFile);

            if (!isFile) {
                // 如果是文件夹，收集其中的所有文件路径
                const files: string[] = [];
                await this.getAllFiles(fileOrDir.fsPath, files);
                // 按照路径长度排序，确保先删除深层文件
                files.sort((a, b) => b.length - a.length);
                // 保存到专门的 Map 中
                this.folderFilesMap.set(fileOrDir.fsPath, files);

                if (files) {
                  for (const filePath of files) {
                    //删除/清空doc
                    const path = this.repoEditor.getRelativePath(filePath);
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

      // 文件或文件夹删除事件
      private onNodeDelete = async({files}: FileDeleteEvent) => {
        const fileOrDir = files[0];
        const relativePath = this.repoEditor.getRelativePath(fileOrDir.fsPath);
        const fileName = basename(fileOrDir.fsPath);
        const isFile = this.isFileMap.get(fileOrDir.fsPath);

        await this.mutex.runExclusive(async() => {
            if (!isFile) {
                // 从专门的 Map 中获取文件列表
                const folderFiles = this.folderFilesMap.get(fileOrDir.fsPath);
                if (folderFiles) {
                    for (const filePath of folderFiles) {
                        const relPath = this.repoEditor.getRelativePath(filePath);
                        console.log('删除文件:', relPath);
                        
                        await this.clientRepo.onLocalNodeDelete(relPath, basename(relPath), true);
                    }
                    // 删除文件列表
                    this.folderFilesMap.delete(fileOrDir.fsPath);
                }
                 // 最后发送文件夹的删除动作

                 let folderDeleteAction = new NodeDeleteAction(
                  this.clientRepo.getUser(),
                  relativePath,
                  fileName,
                  false  // 这是文件夹

              );
              let websocketConnection = this.clientRepo.getWebsocketConnection();
              websocketConnection.sendData(folderDeleteAction);
  
            } else {
                // 如果是单个文件，直接发送删除动作
                await this.clientRepo.onLocalNodeDelete(relativePath, fileName,true);
            }
        });

        // 清理 isFileMap
        this.isFileMap.delete(fileOrDir.fsPath);
      };
      
      // 递归获取文件夹下所有文件的路径
      private async getAllFiles(dirPath: string, files: string[]) {
        try {
            const dirUri = Uri.file(dirPath);
            const entries = await workspace.fs.readDirectory(dirUri);
            
            for (const [name, type] of entries) {
                const fullPath = path.join(dirPath, name);
                console.log('处理路径:', fullPath, 'type:', type);  // 调试日志
                
                if (type === FileType.File) {
                    files.push(fullPath);
                } else if (type === FileType.Directory) {
                    try {
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

      // 文件或文件夹重命名事件
      private onNodeRename = async({ files }: FileRenameEvent) => {
        const { oldUri, newUri } = files[0];
        // 获取相对路径
        const oldPath = this.repoEditor.getRelativePath(oldUri.fsPath);
        // 获取原来文件名
        const oldName = basename(oldUri.fsPath);
        // 获取新文件名
        const newName = basename(newUri.fsPath);
        
        // 判断是文件还是文件夹
        const stats = await workspace.fs.stat(newUri);
        const isFile = stats.type === 1;
        console.log('重命名......');
        await this.mutex.runExclusive(async() => {
          // 重命名动作
          let nodeRenameAction = new NodeRenameAction(
              this.clientRepo.getUser(),
              oldPath,
              oldName,
              isFile,
              newName
          );
          let websocketConnection = this.clientRepo.getWebsocketConnection();
          websocketConnection.sendData(nodeRenameAction);
        });
      };

      // 文件打开事件
      private onFileOpen = async(textDocument: TextDocument) => {
        if (textDocument.uri.scheme !== "file") {
          return;
        }
        console.log('打开......');
        await this.clientRepo.onLocalFileOpen(textDocument);
        await this.repoEditor.updateCursorDecorators();
      };

      // 文件关闭事件
      private onFileClose = async(textDocument: TextDocument) => {
        if (textDocument.uri.scheme !== "file") {
          return;
        }
        console.log('关闭......');
        await this.clientRepo.onLocalFileClose(this.repoEditor.getRelativePath(textDocument.uri.fsPath));
        await this.repoEditor.updateCursorDecorators();
      };

      // 文件内容变化事件
      private onChangeTextDocument = async(textDocumentChangeEvent: TextDocumentChangeEvent) => {
        if (textDocumentChangeEvent.document.uri.scheme !== "file") {
          return;
        }
        console.log('内容变化......');
        const activeEditor = window.activeTextEditor;
        if (activeEditor) {
          const position = activeEditor.selection.active;
          if (activeEditor.document.uri.scheme === "file") {
            this.clientRepo.onLocalCursorMove(
              this.repoEditor.getRelativePath(activeEditor.document.uri.fsPath),
              activeEditor.document.fileName,
              activeEditor.document.offsetAt(position)
            );
          }
        }
        await this.clientRepo.onLocalFileChange(textDocumentChangeEvent);
      };

      // 文本编辑器选择变化事件
      private onChangeSeletion = async ({ textEditor, selections }: TextEditorSelectionChangeEvent) => {
        if (textEditor.document.uri.scheme !== "file") {
          return;
        }
        await this.clientRepo.onLocalCursorMove(
          this.repoEditor.getRelativePath(textEditor.document.uri.fsPath),
          textEditor.document.fileName,
          textEditor.document.offsetAt(selections[0].active)
        );
      };

      // 可见文本编辑器变化事件
      private onChangeVisibleTextEditors = async () => {
        await this.repoEditor.updateCursorDecorators();
      };

      // 设置监听器
      async setListeners(){
        this.removeListeners();
        
        // 直接关闭所有打开的文件
        const tabGroups = window.tabGroups;
        // 收集所有需要关闭的标签页
        const tabsToClose = tabGroups.all.flatMap(group => 
          group.tabs.filter(tab => tab.input instanceof TabInputText)
        );
        
        // 一次性关闭所有标签页
        if (tabsToClose.length > 0) {
          await window.tabGroups.close(tabsToClose);
        }

        // 设置监听器
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

      // 移除监听器
      removeListeners(){
        this.listeners.forEach((listener) => listener.dispose());
        this.listeners = [];
      }
}