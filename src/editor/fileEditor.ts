import { Range, TextDocument, workspace, WorkspaceEdit } from 'vscode';
import { readFile, writeFile } from 'fs/promises';
import { RepoEditor } from './repoEditor';
import { basename } from 'path';

export class FileEditor {
    private relativePath: string;
    private fileName: string;
    private absolutePath: string;
    private isOpened: boolean;
    private textDocument: TextDocument | null;
    private repoEditor: RepoEditor;

    constructor(repoEditor: RepoEditor, isOpened: boolean, documentOrPath: TextDocument | string) {
        if(isOpened) {
            this.textDocument = documentOrPath as TextDocument;
            this.relativePath = repoEditor.getRelativePath(this.textDocument.uri.fsPath);
            this.fileName = basename(this.textDocument.fileName);
            this.absolutePath = this.textDocument.uri.fsPath;
        } 
        else {
            this.textDocument = null;
            this.relativePath = documentOrPath as string;
            this.fileName = basename(this.relativePath);
            this.absolutePath = repoEditor.getAbsolutePath(this.relativePath);
        }
        this.isOpened = isOpened;
        this.repoEditor = repoEditor; 
    }

    getRelativePath(){
      return this.relativePath;
    }

    getAbsolutePath(){
      return this.absolutePath;
    }

    getFileName(){
      return this.fileName;
    }

    getIsOpened(){
      return this.isOpened;
    }

    getCurrentContent(){
        if(this.isOpened){
            return this.textDocument!.getText();
        }
        else{
            return readFile(this.absolutePath, { encoding: 'utf-8' });
        }
    }

    getTextDocument(){
      if(this.isOpened){
        return this.textDocument;
      }
      else{
        return null;
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