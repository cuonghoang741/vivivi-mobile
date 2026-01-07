/**
 * Primary colors
 * These are the main neutral, brand and semantic colors
 * that make up the majority of the colors used in the design system and components.
 */

export const base = {
  white: '#FFFFFF',
  black: '#000000',
  transparent: '#FFFFFF00',
} as const;

export const grayLight = {
  25: '#FCFCFD',
  50: '#F9FAFB',
  100: '#F2F4F7',
  200: '#edf0f5',
  300: '#D0D5DD',
  400: '#98A2B3',
  500: '#667085',
  600: '#475467',
  700: '#344054',
  800: '#182230',
  900: '#101828',
  950: '#0C111D',
} as const;

export const grayDark = {
  25: '#FAFAFA',
  50: '#F5F5F6',
  100: '#F0F1F1',
  200: '#ECECED',
  300: '#CECFD2',
  400: '#94969C',
  500: '#85888E',
  600: '#61646C',
  700: '#333741',
  800: '#1F242F',
  900: '#161B26',
  950: '#0C111D',
} as const;

export const brand = {
  25: '#fff5f8',
  50: '#ffe8f0',
  100: '#ffd6e5',
  200: '#ffb3cc',
  300: '#ff8fb3',
  400: '#ff6b99',
  500: '#ff579a',
  600: '#e64d8a',
  700: '#cc447a',
  800: '#b33a6a',
  900: '#993059',
  950: '#661f3b',
} as const;

export const error = {
  25: '#FFFBFA',
  50: '#FEF3F2',
  100: '#FEE4E2',
  200: '#FECDCA',
  300: '#FDA29B',
  400: '#F97066',
  500: '#F04438',
  600: '#D92D20',
  700: '#B42318',
  800: '#912018',
  900: '#7A271A',
  950: '#55160C',
} as const;

export const warning = {
  25: '#FFFCF5',
  50: '#FFFAEB',
  100: '#FEF0C7',
  200: '#FEDF89',
  300: '#FEC84B',
  400: '#FDB022',
  500: '#F79009',
  600: '#DC6803',
  700: '#B54708',
  800: '#93370D',
  900: '#7A2E0E',
  950: '#4E1D09',
} as const;

export const success = {
  25: '#F6FEF9',
  50: '#ECFDF3',
  100: '#DCFAE6',
  200: '#ABEFC6',
  300: '#75E0A7',
  400: '#47CD89',
  500: '#17B26A',
  600: '#079455',
  700: '#067647',
  800: '#085D3A',
  900: '#074D31',
  950: '#053321',
} as const;

/**
 * Secondary colors
 * Along with primary colors, it's helpful to have a selection
 * of secondary colors to use in components such as pills, alerts and labels.
 * These secondary colors should be used sparingly or as accents,
 * while the primary color(s) should take precedence.
 */

export const grayBlue = {
  25: '#FCFCFD',
  50: '#F8F9FC',
  100: '#EAECF5',
  200: '#D5D9EB',
  300: '#B3B8DB',
  400: '#717BBC',
  500: '#4E5BA6',
  600: '#3E4784',
  700: '#363F72',
  800: '#293056',
  900: '#101323',
  950: '#0D0F1C',
} as const;

export const grayCool = {
  25: '#FCFCFD',
  50: '#F9F9FB',
  100: '#EFF1F5',
  200: '#DCDFEA',
  300: '#B9C0D4',
  400: '#7D89B0',
  500: '#5D6B98',
  600: '#4A5578',
  700: '#404968',
  800: '#30374F',
  900: '#111322',
  950: '#0E101B',
} as const;

export const grayModern = {
  25: '#FCFCFD',
  50: '#F8FAFC',
  100: '#EEF2F6',
  200: '#E3E8EF',
  300: '#CDD5DF',
  400: '#9AA4B2',
  500: '#697586',
  600: '#4B5565',
  700: '#364152',
  800: '#202939',
  900: '#121926',
  950: '#0D121C',
} as const;

export const grayNeutral = {
  25: '#fcfcfd',
  50: '#f9fafb',
  100: '#f3f4f6',
  200: '#e5e7eb',
  300: '#d2d6db',
  400: '#9da4ae',
  500: '#6c737f',
  600: '#4d5761',
  700: '#384250',
  800: '#1f2a37',
  900: '#111927',
  950: '#0d121c',
} as const;

export const grayIron = {
  25: '#fcfcfc',
  50: '#fafafa',
  100: '#f4f4f5',
  200: '#e4e4e7',
  300: '#d1d1d6',
  400: '#a0a0ab',
  500: '#70707b',
  600: '#51525c',
  700: '#3f3f46',
  800: '#26272b',
  900: '#1a1a1e',
  950: '#131316',
} as const;

export const grayTrue = {
  25: '#fcfcfc',
  50: '#f7f7f7',
  100: '#f5f5f5',
  200: '#e5e5e5',
  300: '#d6d6d6',
  400: '#a3a3a3',
  500: '#737373',
  600: '#525252',
  700: '#424242',
  800: '#292929',
  900: '#141414',
  950: '#0f0f0f',
} as const;

export const grayWarm = {
  25: '#fdfdfc',
  50: '#fafaf9',
  100: '#f5f5f4',
  200: '#e7e5e4',
  300: '#d7d3d0',
  400: '#a9a29d',
  500: '#79716b',
  600: '#57534e',
  700: '#44403c',
  800: '#292524',
  900: '#1c1917',
  950: '#171412',
} as const;

export const moss = {
  25: '#fafdf7',
  50: '#f5fbee',
  100: '#e6f4d7',
  200: '#ceeab0',
  300: '#acdc79',
  400: '#86cb3c',
  500: '#669f2a',
  600: '#4f7a21',
  700: '#3f621a',
  800: '#335015',
  900: '#2b4212',
  950: '#1a280b',
} as const;

export const greenLight = {
  25: '#fafef5',
  50: '#f3fee7',
  100: '#e3fbcc',
  200: '#d0f8ab',
  300: '#a6ef67',
  400: '#85e13a',
  500: '#66c61c',
  600: '#4ca30d',
  700: '#3b7c0f',
  800: '#326212',
  900: '#2b5314',
  950: '#15290a',
} as const;

export const green = {
  25: '#f6fef9',
  50: '#edfcf2',
  100: '#d3f8df',
  200: '#aaf0c4',
  300: '#73e2a3',
  400: '#3ccb7f',
  500: '#16b364',
  600: '#099250',
  700: '#087443',
  800: '#095c37',
  900: '#084c2e',
  950: '#052e1c',
} as const;

export const teal = {
  25: '#f6fefc',
  50: '#f0fdf9',
  100: '#ccfbef',
  200: '#99f6e0',
  300: '#5fe9d0',
  400: '#2ed3b7',
  500: '#15b79e',
  600: '#0e9384',
  700: '#107569',
  800: '#125d56',
  900: '#134e48',
  950: '#0a2926',
} as const;

export const cyan = {
  25: '#f5feff',
  50: '#ecfdff',
  100: '#cff9fe',
  200: '#a5f0fc',
  300: '#67e3f9',
  400: '#22ccee',
  500: '#06aed4',
  600: '#088ab2',
  700: '#0e7090',
  800: '#155b75',
  900: '#164c63',
  950: '#0d2d3a',
} as const;

export const blueLight = {
  25: '#f5fbff',
  50: '#f0f9ff',
  100: '#e0f2fe',
  200: '#b9e6fe',
  300: '#7cd4fd',
  400: '#36bffa',
  500: '#0ba5ec',
  600: '#0086c9',
  700: '#026aa2',
  800: '#065986',
  900: '#0b4a6f',
  950: '#062c41',
} as const;

export const blue = {
  25: '#f5faff',
  50: '#eff8ff',
  100: '#d1e9ff',
  200: '#b2ddff',
  300: '#84caff',
  400: '#53b1fd',
  500: '#2e90fa',
  600: '#1570ef',
  700: '#175cd3',
  800: '#1849a9',
  900: '#194185',
  950: '#102a56',
} as const;

export const blueDark = {
  25: '#f5f8ff',
  50: '#eff4ff',
  100: '#d1e0ff',
  200: '#b2ccff',
  300: '#84adff',
  400: '#528bff',
  500: '#2970ff',
  600: '#155eef',
  700: '#004eeb',
  800: '#0040c1',
  900: '#00359e',
  950: '#002266',
} as const;

export const indigo = {
  25: '#f5f8ff',
  50: '#eef4ff',
  100: '#e0eaff',
  200: '#c7d7fe',
  300: '#a4bcfd',
  400: '#8098f9',
  500: '#6172f3',
  600: '#444ce7',
  700: '#3538cd',
  800: '#2d31a6',
  900: '#2d3282',
  950: '#1f235b',
} as const;

export const violet = {
  25: '#fbfaff',
  50: '#f5f3ff',
  100: '#ece9fe',
  200: '#ddd6fe',
  300: '#c3b5fd',
  400: '#a48afb',
  500: '#875bf7',
  600: '#7839ee',
  700: '#6927da',
  800: '#5720b7',
  900: '#491c96',
  950: '#2e125e',
} as const;

export const purple = {
  25: '#fafaff',
  50: '#f4f3ff',
  100: '#ebe9fe',
  200: '#d9d6fe',
  300: '#bdb4fe',
  400: '#9b8afb',
  500: '#7a5af8',
  600: '#6938ef',
  700: '#5925dc',
  800: '#4a1fb8',
  900: '#3e1c96',
  950: '#27115f',
} as const;

export const fuchsia = {
  25: '#fefaff',
  50: '#fdf4ff',
  100: '#fbe8ff',
  200: '#f6d0fe',
  300: '#eeaafd',
  400: '#e478fa',
  500: '#d444f1',
  600: '#ba24d5',
  700: '#9f1ab1',
  800: '#821890',
  900: '#6f1877',
  950: '#47104c',
} as const;

export const pink = {
  25: '#fef6fb',
  50: '#fdf2fa',
  100: '#fce7f6',
  200: '#fcceee',
  300: '#faa7e0',
  400: '#f670c7',
  500: '#ee46bc',
  600: '#dd2590',
  700: '#c11574',
  800: '#9e165f',
  900: '#851651',
  950: '#4e0d30',
} as const;

export const rose = {
  25: '#fff5f6',
  50: '#fff1f3',
  100: '#ffe4e8',
  200: '#fecdd6',
  300: '#fea3b4',
  400: '#fd6f8e',
  500: '#f63d68',
  600: '#e31b54',
  700: '#c01048',
  800: '#a11043',
  900: '#89123e',
  950: '#510b24',
} as const;

export const orangeDark = {
  25: '#fff9f5',
  50: '#fff4ed',
  100: '#ffe6d5',
  200: '#ffd6ae',
  300: '#ff9c66',
  400: '#ff692e',
  500: '#ff4405',
  600: '#e62e05',
  700: '#bc1b06',
  800: '#97180c',
  900: '#771a0d',
  950: '#57130a',
} as const;

export const orange = {
  25: '#fefaf5',
  50: '#fef6ee',
  100: '#fdead7',
  200: '#f9dbaf',
  300: '#f7b27a',
  400: '#f38744',
  500: '#ef6820',
  600: '#e04f16',
  700: '#b93815',
  800: '#932f19',
  900: '#772917',
  950: '#511c10',
} as const;

export const yellow = {
  25: '#fefdf0',
  50: '#fefbe8',
  100: '#fef7c3',
  200: '#feee95',
  300: '#fde272',
  400: '#fac515',
  500: '#eaaa08',
  600: '#ca8504',
  700: '#a15c07',
  800: '#854a0e',
  900: '#713b12',
  950: '#542c0d',
} as const;

const palette = {
  // Primary colors
  ...base,
  grayLight,
  grayDark,
  brand: brand,
  error,
  warning,
  success,

  // Secondary colors
  grayBlue,
  grayCool,
  grayIron,
  grayModern,
  grayNeutral,
  grayTrue,
  grayWarm,

  moss,
  greenLight,
  green,
  teal,
  cyan,
  blueLight,
  blue,
  blueDark,
  indigo,
  violet,
  purple,
  fuchsia,
  pink,
  rose,
  orangeDark,
  orange,
  yellow,
};

export default palette;
