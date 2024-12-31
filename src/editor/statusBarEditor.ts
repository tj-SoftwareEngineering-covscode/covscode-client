import { MarkdownString, StatusBarItem } from 'vscode';
import {UserInfo} from './repoEditor';
import  {ClientUser} from '../entity/clientUser';

export class StatusBarEditor{
    private statusBarItem: StatusBarItem;

    constructor(statusBarItem: StatusBarItem){
        this.statusBarItem = statusBarItem;
    }


    // 初始化状态栏
    initStatusBar(userInfo: UserInfo): void{
        this.statusBarItem.text = `$RepoId: ${userInfo.clientUser.getRepoId()}, SiteId: ${userInfo.clientUser.getSiteId()}`;
        this.statusBarItem.tooltip = this.getStatusBarTooltip(userInfo.allUsers);
    }

    updateStatusBar(allUsers: ClientUser[]): void{
        this.statusBarItem.tooltip = this.getStatusBarTooltip(allUsers);
    }

    private getStatusBarTooltip(allUsers: ClientUser[]): MarkdownString{
        const tooltip = new MarkdownString();
        tooltip.supportHtml = true;
        tooltip.isTrusted = true;
        tooltip.supportThemeIcons = true;
        tooltip.appendMarkdown('### 当前用户\n');
        allUsers.forEach(user => tooltip.appendMarkdown(`- Site: ${user.getSiteId()} ${user.getUserId}\n`));
        return tooltip;
    }
}