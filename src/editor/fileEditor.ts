import { Range, TextDocument, workspace, WorkspaceEdit } from 'vscode';
import { readFile, writeFile } from 'fs/promises';
import {RepoEditor} from './repoEditor';

export class FileEditor{
    relativePath: string;
    fileName: string;
    absolutePath: string;
    isOpened: boolean;
    textDocument: TextDocument | null;
    repoEditor: RepoEditor;

    // constructor(repoEditor: RepoEditor, isOpened: boolean, textDocument: TextDocument);
    // constructor(repoEditor: RepoEditor, isOpened: boolean, path: string);

    constructor(repoEditor: RepoEditor, isOpened: boolean, documentOrPath: TextDocument | string) {
        if(isOpened){
            this.textDocument = documentOrPath as TextDocument;
            this.relativePath = repoEditor.getRelativePath(this.textDocument.uri.fsPath);
            this.fileName = this.textDocument.fileName;
            this.absolutePath = this.textDocument.uri.fsPath;
        }
        else{
            this.textDocument = null;
            this.relativePath = documentOrPath as string;
            this.fileName = ' '; //后续补充
            this.absolutePath = repoEditor.getAbsolutePath(this.relativePath);
        }
        this.isOpened = isOpened;
        this.repoEditor = repoEditor; 
    }

    getCurrentContent(){
        if(this.isOpened){
            return this.textDocument!.getText();
        }
        else{
            return readFile(this.absolutePath, { encoding: 'utf-8' });
        }
    }

    async onRewrite(content: string): Promise<void> {
        if (this.isOpened) {
          const textDocument = this.textDocument!;
          const endPosition = textDocument.lineAt(textDocument.lineCount - 1).range.end;
          // 创建一个新的 WorkspaceEdit 对象，用于批量应用编辑操作
          const edit = new WorkspaceEdit();
          // 在整个文件范围内替换内容
          edit.replace(
            textDocument.uri,
            new Range(textDocument.positionAt(0), endPosition),
            content
          );
          // 应用编辑操作，将新的内容写入打开的文件。
          await workspace.applyEdit(edit);
          this.repoEditor.updateCursorDecorators();
        } else {
          await writeFile(this.absolutePath, content);
        }
      }
    
}