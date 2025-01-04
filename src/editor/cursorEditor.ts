import { window, TextEditor, Range, TextEditorDecorationType } from 'vscode';
import  {ClientUser} from '../entity/clientUser';
import { CURSOR_COLORS, DECORATION_STYLE } from '../constant';
import assert from 'assert';

export interface UserCursorInfo {
    user: ClientUser;
    cursorPosition: {
      filePath: string;
      position: number;
    };
}

export class CursorEditor {
    private cursorDecoratorType : TextEditorDecorationType;
    private userCursorInfoList: UserCursorInfo[] = [];

    constructor(){
        this.cursorDecoratorType = window.createTextEditorDecorationType({});
    }

    // dispose(){
    //     this.cursorDecoratorType.dispose();
    // }

    // 更新光标视图效果
    updateCursorDecorators() {
        const visibleEditors = this.getVisibleEditors();
        const visibleEditorInfoMap = this.mapUserCursorsToEditors(visibleEditors);
        this.applyDecorationsToEditors(visibleEditorInfoMap);
    }

    // 获取所有可见的编辑器
    private getVisibleEditors(): TextEditor[] {
        return window.visibleTextEditors.filter(editor => editor.document.uri.scheme === 'file');
    }

    // 将用户光标信息映射到编辑器
    private mapUserCursorsToEditors(visibleEditors: TextEditor[]): Map<TextEditor, UserCursorInfo[]> {
        const editorInfoMap = new Map<TextEditor, UserCursorInfo[]>();
      
        this.userCursorInfoList.forEach(info => {
          const targetEditor = visibleEditors.find(
            editor => editor.document.uri.fsPath.endsWith(info.cursorPosition.filePath)
        );
      
          if (targetEditor) {
            const targetInfos = editorInfoMap.get(targetEditor) || [];
            targetInfos.push(info);
            editorInfoMap.set(targetEditor, targetInfos);
          }
        });
        return editorInfoMap;
    }

    // 将光标装饰器应用到编辑器
    private applyDecorationsToEditors(editorInfoMap: Map<TextEditor, UserCursorInfo[]>) {
        editorInfoMap.forEach((cursorInfos, editor) => {
            let decorationOptions = cursorInfos.map((info, index) => {
                let linePosition = editor.document.positionAt(info.cursorPosition.position);
                let cursorPosition = editor.document.lineAt(linePosition.line).range.end;
                let color = CURSOR_COLORS[index % CURSOR_COLORS.length];
                return {
                  range: new Range(cursorPosition, cursorPosition),
                  renderOptions: {
                    ...DECORATION_STYLE,
                    before: {
                      ...DECORATION_STYLE.before,
                      backgroundColor: color,
                      contentText: info.user.getUserId(),
                    },
                  },
                };
              });
              editor.setDecorations(this.cursorDecoratorType, decorationOptions);
        });
    }


    // 更新光标信息
    updateCursorInfos(user: ClientUser, filePath: string, position: number) {
        assert(user.getSiteId(), 'siteId is required for cursorMove');

        // 查找当前用户的光标信息
        const targetInfo = this.userCursorInfoList.find(info => info.user.getSiteId() === user.getSiteId() );

        if (targetInfo) {
            targetInfo.cursorPosition = { filePath, position };
        } else {
            this.userCursorInfoList.push({ user, cursorPosition: { filePath, position } });
        }
    }

    // 移除光标信息
    removeCursorInfo(user: ClientUser) {
        if (user.getSiteId()) {
            const index = this.userCursorInfoList.findIndex(info => info.user.getSiteId() === user.getSiteId() );
            
            if (index !== -1) {
                this.userCursorInfoList.splice(index, 1);
            }
        }
    }

    // 重置光标信息
    resetCursorInfo(){
        this.userCursorInfoList.splice(0, this.userCursorInfoList.length);
    }

}
