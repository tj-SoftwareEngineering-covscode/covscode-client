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
} from "vscode";
import { basename } from 'path';
import { Mutex } from 'async-mutex';

export class WorkspaceWatcher{
      private clientRepo: ClientRepo;
      private repoEditor: RepoEditor;
      private listeners: Disposable[] = [];
      private isDirMap: Map<string, boolean> = new Map(); 
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
            ' '
          );
          let websocketConnection = this.clientRepo.getWebsocketConnection();
          websocketConnection.sendData(nodeCreateAction);
        });  
      };


      // 设置文件或文件夹是否为文件夹
      private async setIsDir(path: string) {
        const stats = await workspace.fs.stat(Uri.file(path));
        const isDir = stats.type === 2;  // 2 表示文件夹
        this.isDirMap.set(path, isDir);
      }


      // 处理文件或文件夹即将删除事件
      private onWillDeleteNode = (event: FileWillDeleteEvent) => {
        const fileOrDir = event.files[0];
        event.waitUntil(this.setIsDir(fileOrDir.fsPath));
      };

     
      // 文件或文件夹删除事件
      private onNodeDelete = async({files}: FileDeleteEvent) => {
        const fileOrDir = files[0];
        // 获取相对路径
        const relativePath = this.repoEditor.getRelativePath(fileOrDir.fsPath);
        // 获取文件名
        const fileName = basename(fileOrDir.fsPath);
        // 判断是文件还是文件夹
        const isFile = this.isDirMap.get(fileOrDir.fsPath) ;
        // 从Map中删除记录
        this.isDirMap.delete(fileOrDir.fsPath);
        console.log('删除......');
        await this.mutex.runExclusive(async() => {
          // 删除动作
          let nodeDeleteAction = new NodeDeleteAction(
              this.clientRepo.getUser(),
              relativePath,
              fileName,
              isFile
          );
          let websocketConnection = this.clientRepo.getWebsocketConnection();
          websocketConnection.sendData(nodeDeleteAction);
        });
      };
      

      // 文件或文件夹重命名事件
      private onNodeRename = async({ files }: FileRenameEvent) => {
        const { oldUri, newUri } = files[0];
        // 获取相对路径
        const oldPath = this.repoEditor.getRelativePath(oldUri.fsPath);
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
              newName,
              isFile
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
        this.clientRepo.onLocalFileOpen(textDocument);
        this.repoEditor.updateCursorDecorators();
      };

      // 文件关闭事件
      private onFileClose = async(textDocument: TextDocument) => {
        if (textDocument.uri.scheme !== "file") {
          return;
        }
        console.log('关闭......');
        this.clientRepo.onLocalFileClose(this.repoEditor.getRelativePath(textDocument.uri.fsPath));
        this.repoEditor.updateCursorDecorators();
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
        console.log('......');
      };

      // 文本编辑器选择变化事件
      private onChangeSeletion = ({ textEditor, selections }: TextEditorSelectionChangeEvent) => {
        if (textEditor.document.uri.scheme !== "file") {
          return;
        }
        this.clientRepo.onLocalCursorMove(
          this.repoEditor.getRelativePath(textEditor.document.uri.fsPath),
          textEditor.document.fileName,
          textEditor.document.offsetAt(selections[0].active)
        );
      };

      // 可见文本编辑器变化事件
      private onChangeVisibleTextEditors = () => {
        this.repoEditor.updateCursorDecorators();
      };

      // 设置监听器
      setListeners(){
        this.removeListeners();
        // 第一个参数代表回调函数，第二个代表this指向，第三个参数代表存储监听器的数组
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