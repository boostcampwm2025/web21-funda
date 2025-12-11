// src/styles/colors.ts
export const colors = {
    light: {
        text: {
            light: '#fefefefe',
            default: '#4e4866',
            strong: '#eff0f6',
        },
        surface: {
            default: '#f7f7fc',
            bold: '#eff0f6',
            strong: '#fefefefe',
        },
        border: {
            default: '#d8d8e9',
            active: '#4e4866',
        },
        primary: {
            surface: '#d1cef9',
            light: '#a29aff',
            main: '#6555ea',
            dark: '#4a3fbb',
        },
        success: {
            light: '#c0fce7',
            main: '#02d05c',
        },
        error: {
            surface: '#ffe2e2',
            main: '#fb2c36',
        },
    },
    dark: {
        text: {
            light: '#a0a3bd',
            default: '#bec1d5',
            strong: '#fefefefe',
        },
        surface: {
            default: '#141428',
            bold: '#4e4866',
            strong: '#6e7191',
        },
        border: {
            default: '#6e7191',
            active: '#d8d8e9',
        },
        primary: {
            surface: '#d1cef9',
            light: '#a29aff',
            main: '#6555ea',
            dark: '#4a3fbb',
        },
        success: {
            light: '#c0fce7',
            main: '#02d05c',
        },
        error: {
            surface: '#ffe2e2',
            main: '#fb2c36',
        },
    },
} as const;
