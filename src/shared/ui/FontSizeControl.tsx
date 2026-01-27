// src/components/Form/mainTable/FontSizeControl.tsx

import React, { useState, useEffect, useCallback } from 'react';
import { Slider, Popover, IconButton, Tooltip, Typography, Box } from '@mui/material';
import TextFieldsIcon from '@mui/icons-material/TextFields';
import RestartAltIcon from '@mui/icons-material/RestartAlt';

// ═══════════════════════════════════════════════════════════
// ТИПЫ
// ═══════════════════════════════════════════════════════════

export type FontSizePreset = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

type FontSizeConfig = {
    fontSize: number;
    headerFontSize: number;
    subheaderFontSize: number;
    inputFontSize: number;
    cellPadding: string;
    headerPadding: string;
    inputPadding: string;
    lineHeight: number;
    headerRowHeight: number;
};

// ═══════════════════════════════════════════════════════════
// ПРЕСЕТЫ РАЗМЕРОВ
// ═══════════════════════════════════════════════════════════

const FONT_SIZE_PRESETS: Record<FontSizePreset, FontSizeConfig> = {
    xs: {
        fontSize: 10,
        headerFontSize: 10,
        subheaderFontSize: 9,
        inputFontSize: 10,
        cellPadding: '3px 4px',
        headerPadding: '4px 5px',
        inputPadding: '3px 4px',
        lineHeight: 1.2,
        headerRowHeight: 30,
    },
    sm: {
        fontSize: 11,
        headerFontSize: 11,
        subheaderFontSize: 10,
        inputFontSize: 11,
        cellPadding: '4px 6px',
        headerPadding: '5px 6px',
        inputPadding: '4px 6px',
        lineHeight: 1.25,
        headerRowHeight: 34,
    },
    md: {
        fontSize: 13,
        headerFontSize: 13,
        subheaderFontSize: 12,
        inputFontSize: 13,
        cellPadding: '6px 8px',
        headerPadding: '7px 8px',
        inputPadding: '5px 7px',
        lineHeight: 1.3,
        headerRowHeight: 38,
    },
    lg: {
        fontSize: 14,
        headerFontSize: 14,
        subheaderFontSize: 13,
        inputFontSize: 14,
        cellPadding: '7px 10px',
        headerPadding: '8px 10px',
        inputPadding: '6px 8px',
        lineHeight: 1.35,
        headerRowHeight: 42,
    },
    xl: {
        fontSize: 16,
        headerFontSize: 16,
        subheaderFontSize: 15,
        inputFontSize: 16,
        cellPadding: '8px 12px',
        headerPadding: '10px 12px',
        inputPadding: '7px 10px',
        lineHeight: 1.4,
        headerRowHeight: 48,
    },
};

const PRESET_LABELS: Record<FontSizePreset, string> = {
    xs: 'XS',
    sm: 'S',
    md: 'M',
    lg: 'L',
    xl: 'XL',
};

const PRESET_ORDER: FontSizePreset[] = ['xs', 'sm', 'md', 'lg', 'xl'];

// ═══════════════════════════════════════════════════════════
// STORAGE KEY
// ═══════════════════════════════════════════════════════════

const STORAGE_KEY = 'main-table-font-size';

// ═══════════════════════════════════════════════════════════
// ХЕЛПЕРЫ
// ═══════════════════════════════════════════════════════════

function getDefaultPreset(): FontSizePreset {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved && PRESET_ORDER.includes(saved as FontSizePreset)) {
            return saved as FontSizePreset;
        }
    } catch (e) {
        // localStorage недоступен
    }
    return 'sm';
}

function savePreset(preset: FontSizePreset) {
    try {
        localStorage.setItem(STORAGE_KEY, preset);
    } catch (e) {
        // localStorage недоступен
    }
}

function applyFontSizeToRoot(config: FontSizeConfig) {
    const root = document.documentElement;
    root.style.setProperty('--tbl-font-size', `${config.fontSize}px`);
    root.style.setProperty('--tbl-header-font-size', `${config.headerFontSize}px`);
    root.style.setProperty('--tbl-subheader-font-size', `${config.subheaderFontSize}px`);
    root.style.setProperty('--tbl-input-font-size', `${config.inputFontSize}px`);
    root.style.setProperty('--tbl-cell-padding', config.cellPadding);
    root.style.setProperty('--tbl-header-padding', config.headerPadding);
    root.style.setProperty('--tbl-input-padding', config.inputPadding);
    root.style.setProperty('--tbl-line-height', String(config.lineHeight));
    root.style.setProperty('--main-head-row-1', `${config.headerRowHeight}px`);
}

// ═══════════════════════════════════════════════════════════
// ХУК ДЛЯ УПРАВЛЕНИЯ РАЗМЕРОМ ШРИФТА
// ═══════════════════════════════════════════════════════════

export function useFontSizeControl() {
    const [preset, setPreset] = useState<FontSizePreset>(getDefaultPreset);

    useEffect(() => {
        applyFontSizeToRoot(FONT_SIZE_PRESETS[preset]);
    }, [preset]);

    const changePreset = useCallback((newPreset: FontSizePreset) => {
        setPreset(newPreset);
        savePreset(newPreset);
    }, []);

    const resetToDefault = useCallback(() => {
        changePreset('sm');
    }, [changePreset]);

    return {
        preset,
        changePreset,
        resetToDefault,
        config: FONT_SIZE_PRESETS[preset],
    };
}

// ═══════════════════════════════════════════════════════════
// СТИЛИ — используем CSS переменные темы
// ═══════════════════════════════════════════════════════════

const iconButtonSx = {
    color: 'var(--theme-text-muted)',
    '&:hover': {
        color: 'var(--theme-text-primary)',
        backgroundColor: 'var(--theme-hover)',
    },
};

const iconButtonOpenSx = {
    ...iconButtonSx,
    color: 'var(--theme-primary)',
};

const popoverPaperSx = {
    backgroundColor: 'var(--dropdown-bg)',
    border: '1px solid var(--theme-border)',
    borderRadius: '8px',
    p: 2,
    minWidth: 220,
};

const sliderSx = {
    color: 'var(--theme-primary)',
    '& .MuiSlider-mark': {
        backgroundColor: 'var(--theme-text-muted)',
        width: 4,
        height: 4,
        borderRadius: '50%',
    },
    '& .MuiSlider-markActive': {
        backgroundColor: 'var(--theme-primary)',
    },
    '& .MuiSlider-markLabel': {
        color: 'var(--theme-text-muted)',
        fontSize: 11,
        fontWeight: 500,
        '&.MuiSlider-markLabelActive': {
            color: 'var(--theme-text-primary)',
        },
    },
    '& .MuiSlider-thumb': {
        width: 16,
        height: 16,
        '&:hover, &.Mui-focusVisible': {
            boxShadow: '0 0 0 8px var(--theme-focus)',
        },
    },
    '& .MuiSlider-rail': {
        backgroundColor: 'var(--theme-border)',
    },
};

// ═══════════════════════════════════════════════════════════
// КОМПОНЕНТ
// ═══════════════════════════════════════════════════════════

type FontSizeControlProps = {
    className?: string;
};

export const FontSizeControl: React.FC<FontSizeControlProps> = ({ className }) => {
    const { preset, changePreset, resetToDefault } = useFontSizeControl();
    const [anchorEl, setAnchorEl] = useState<HTMLButtonElement | null>(null);

    const handleOpen = (event: React.MouseEvent<HTMLButtonElement>) => {
        setAnchorEl(event.currentTarget);
    };

    const handleClose = () => {
        setAnchorEl(null);
    };

    const open = Boolean(anchorEl);

    const sliderValue = PRESET_ORDER.indexOf(preset);

    const handleSliderChange = (_: Event, value: number | number[]) => {
        const idx = typeof value === 'number' ? value : value[0];
        const newPreset = PRESET_ORDER[idx];
        if (newPreset) {
            changePreset(newPreset);
        }
    };

    const marks = PRESET_ORDER.map((p, idx) => ({
        value: idx,
        label: PRESET_LABELS[p],
    }));

    return (
        <>
            <Tooltip title="Размер шрифта" arrow>
                <IconButton
                    onClick={handleOpen}
                    className={className}
                    size="small"
                    sx={open ? iconButtonOpenSx : iconButtonSx}
                >
                    <TextFieldsIcon sx={{ fontSize: 20 }} />
                </IconButton>
            </Tooltip>

            <Popover
                open={open}
                anchorEl={anchorEl}
                onClose={handleClose}
                anchorOrigin={{
                    vertical: 'bottom',
                    horizontal: 'center',
                }}
                transformOrigin={{
                    vertical: 'top',
                    horizontal: 'center',
                }}
                slotProps={{
                    paper: {
                        sx: popoverPaperSx,
                    },
                }}
            >
                <Box sx={{ width: '100%' }}>
                    {/* Заголовок */}
                    <Box sx={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        mb: 2,
                    }}>
                        <Typography
                            variant="subtitle2"
                            sx={{ color: 'var(--theme-text-primary)', fontWeight: 600 }}
                        >
                            Размер шрифта
                        </Typography>
                        <Tooltip title="Сбросить" arrow>
                            <IconButton
                                size="small"
                                onClick={resetToDefault}
                                sx={{
                                    color: 'var(--theme-text-muted)',
                                    padding: '4px',
                                    '&:hover': {
                                        color: 'var(--theme-text-primary)',
                                        backgroundColor: 'var(--theme-hover)',
                                    },
                                }}
                            >
                                <RestartAltIcon sx={{ fontSize: 18 }} />
                            </IconButton>
                        </Tooltip>
                    </Box>

                    {/* Слайдер */}
                    <Box sx={{ px: 1 }}>
                        <Slider
                            value={sliderValue}
                            onChange={handleSliderChange}
                            min={0}
                            max={PRESET_ORDER.length - 1}
                            step={1}
                            marks={marks}
                            valueLabelDisplay="off"
                            sx={sliderSx}
                        />
                    </Box>

                    {/* Превью текущего размера */}
                    <Box sx={{
                        mt: 2,
                        pt: 2,
                        borderTop: '1px solid var(--theme-border)',
                        textAlign: 'center',
                    }}>
                        <Typography
                            sx={{
                                color: 'var(--theme-text-muted)',
                                fontSize: 10,
                                textTransform: 'uppercase',
                                letterSpacing: 0.5,
                                mb: 0.5,
                            }}
                        >
                            Текущий размер
                        </Typography>
                        <Typography
                            sx={{
                                color: 'var(--theme-text-primary)',
                                fontSize: FONT_SIZE_PRESETS[preset].fontSize,
                                lineHeight: FONT_SIZE_PRESETS[preset].lineHeight,
                            }}
                        >
                            Пример текста · {FONT_SIZE_PRESETS[preset].fontSize}px
                        </Typography>
                    </Box>
                </Box>
            </Popover>
        </>
    );
};

export default FontSizeControl;