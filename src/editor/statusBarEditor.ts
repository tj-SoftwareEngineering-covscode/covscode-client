import { MarkdownString, StatusBarItem } from 'vscode';
import  {ClientUser} from '../entity/clientUser';

export class StatusBarEditor{
    private statusBarItem: StatusBarItem;

    constructor(statusBarItem: StatusBarItem){
        this.statusBarItem = statusBarItem;
    }


    // 初始化状态栏
    initStatusBar(user: ClientUser, allUsers: ClientUser[]): void{
        this.statusBarItem.text = `$RepoId: ${user.getRepoId()}, SiteId: ${user.getSiteId()}`;
        this.statusBarItem.tooltip = this.getStatusBarTooltip(allUsers);
    }

    // 更新状态栏
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