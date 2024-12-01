export enum CurrentStatus{
  On,
  Off
}

//当前插件的运行状态
export let currentStatus:CurrentStatus=CurrentStatus.Off;

export enum StartOption {
  Create,
  Join,
  Quit,
  Other
}

export const CreateOptionName='创建仓库';
export const JoinOptionName='加入仓库';
export const QuitOptionName='退出仓库';