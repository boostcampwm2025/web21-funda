// 1. 기초가 되는 Primitive Colors (이미지의 Color Default Value)
export const palette = {
  grayscale: {
    50: '#FEFEFE',
    100: '#F7F7FC',
    200: '#EFF0F6',
    300: '#D9DBE9',
    400: '#BEC1D5',
    500: '#A0A3BD',
    600: '#6E7191',
    700: '#4E4B66',
    800: '#2A2A44',
    900: '#14142B',
  },
  primary: {
    surface: '#D1CEF9',
    light: '#A29AFF',
    main: '#6559EA',
    dark: '#4A3FB8',
  },
  success: {
    light: '#DCFCE7',
    main: '#02D05C',
  },
  error: {
    surface: '#FFE2E2',
    main: '#FB2C36',
  },
};

// 2. Light / Dark 모드별 시맨틱 컬러 정의 (이미지의 Palette 표 기준)
export const colors = {
  light: {
    text: {
      weak: palette.grayscale[600],
      light: palette.grayscale[700],
      default: palette.grayscale[800],
      strong: palette.grayscale[900],
    },
    surface: {
      default: palette.grayscale[100],
      bold: palette.grayscale[200],
      strong: palette.grayscale[50],
    },
    border: {
      default: palette.grayscale[300],
      active: palette.grayscale[900],
    },
    // 공통 컬러
    ...palette,
  },
  dark: {
    text: {
      weak: palette.grayscale[600],
      light: palette.grayscale[500],
      default: palette.grayscale[400],
      strong: palette.grayscale[50],
    },
    surface: {
      default: palette.grayscale[900],
      bold: palette.grayscale[700],
      strong: palette.grayscale[800],
    },
    border: {
      default: palette.grayscale[600],
      active: palette.grayscale[300],
    },
    // 공통 컬러
    ...palette,
  },
} as const;

export const borderRadius = {
  small: '8px',
  medium: '16px',
  large: '24px',
  xlarge: '40px',
} as const;
