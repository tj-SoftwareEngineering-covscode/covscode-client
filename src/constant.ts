export enum StartOption {
  Create,
  Join,
  Quit,
  Other
}

export const CreateOptionName='创建仓库';
export const JoinOptionName='加入仓库';
export const QuitOptionName='退出仓库';

// 统一管理颜色常量
enum cursorColor {
    BLUE = 'rgba(123, 104, 238, .7)',
    RED = 'rgba(255, 0, 0, .7)',
    PINK = 'rgba(255, 181, 197, .7)',
    GREEN = 'rgba(46, 139, 87, .7)',
    BLACK = 'rgba(0, 0, 0, .7)',
    WHITE = 'rgba(255, 255, 255, 1)',
    WHITE_TRANSPARENT = 'rgba(255, 255, 255, .7)'
}

// 定义颜色常量
export const CURSOR_COLORS = [cursorColor.GREEN, cursorColor.BLUE, cursorColor.PINK, cursorColor.RED];

// 定义光标装饰样式
export const DECORATION_STYLE = {
  before: {
    color: cursorColor.BLACK,
    textDecoration: `none;
      border-radius: 4px;
      position: absolute;
      z-index: 10000;`,
    margin: '0 25px',
  },
  // after: {
  //   contentText: '',
  //   backgroundColor: cursorColor.WHITE,
  //   textDecoration: `none;
  //     height: 100%;
  //     border-left: 2px solid rgba(255, 255, 255, .7)
  //   `,
  //   margin: '0 5px',
  // },
};

// 状态栏图标
export const STATUS_BAR_ICON = 'outline-view-icon';
// 状态栏文本
export const STATUS_BAR_TEXT = 'Co-VsCode';