// src/components/Form/mainTable/CellStylePopover.tsx

import React, { useState } from 'react';
import { Popover, Box, Typography, IconButton, Divider, Tooltip } from '@mui/material';
import FormatColorTextIcon from '@mui/icons-material/FormatColorText';
import FormatColorFillIcon from '@mui/icons-material/FormatColorFill';
import FormatSizeIcon from '@mui/icons-material/FormatSize';
import ClearIcon from '@mui/icons-material/Clear';

export type CellStyles = {
    color?: string;
    backgroundColor?: string;
    fontSize?: number;
};

type CellStylePopoverProps = {
    anchorEl: HTMLElement | null;
    onClose: () => void;
    currentStyle: CellStyles | undefined;
    onStyleChange: (style: CellStyles | null) => void;
    columnName: string;
};

const COLORS = [
    { label: 'Красный', value: '#ef4444' },
    { label: 'Оранжевый', value: '#f97316' },
    { label: 'Жёлтый', value: '#eab308' },
    { label: 'Зелёный', value: '#22c55e' },
    { label: 'Голубой', value: '#06b6d4' },
    { label: 'Синий', value: '#3b82f6' },
    { label: 'Фиолетовый', value: '#a855f7' },
    { label: 'Розовый', value: '#ec4899' },
    { label: 'Белый', value: '#ffffff' },
    { label: 'Серый', value: '#9ca3af' },
    { label: 'Тёмный', value: '#374151' },
    { label: 'Без цвета', value: '' },
];

const FONT_SIZES = [
    { label: 'Мелкий', value: 12 },
    { label: 'Обычный', value: 14 },
    { label: 'Средний', value: 16 },
    { label: 'Крупный', value: 18 },
    { label: 'Большой', value: 22 },
    { label: 'Огромный', value: 28 },
];

export const CellStylePopover: React.FC<CellStylePopoverProps> = ({
                                                                      anchorEl,
                                                                      onClose,
                                                                      currentStyle,
                                                                      onStyleChange,
                                                                      columnName,
                                                                  }) => {
    const handleColorChange = (color: string) => {
        const newStyle = { ...currentStyle };
        if (color) {
            newStyle.color = color;
        } else {
            delete newStyle.color;
        }
        onStyleChange(Object.keys(newStyle).length > 0 ? newStyle : null);
    };

    const handleBgColorChange = (backgroundColor: string) => {
        const newStyle = { ...currentStyle };
        if (backgroundColor) {
            newStyle.backgroundColor = backgroundColor;
        } else {
            delete newStyle.backgroundColor;
        }
        onStyleChange(Object.keys(newStyle).length > 0 ? newStyle : null);
    };

    const handleFontSizeChange = (fontSize: number | null) => {
        const newStyle = { ...currentStyle };
        if (fontSize) {
            newStyle.fontSize = fontSize;
        } else {
            delete newStyle.fontSize;
        }
        onStyleChange(Object.keys(newStyle).length > 0 ? newStyle : null);
    };

    const handleClearStyles = () => {
        onStyleChange(null);
        onClose();
    };

    return (
        <Popover
            open={!!anchorEl}
            anchorEl={anchorEl}
            onClose={onClose}
            anchorOrigin={{
                vertical: 'bottom',
                horizontal: 'left',
            }}
            transformOrigin={{
                vertical: 'top',
                horizontal: 'left',
            }}
            slotProps={{
                paper: {
                    sx: {
                        backgroundColor: '#2a2a2a',
                        color: '#fff',
                        p: 2,
                        minWidth: 240,
                        borderRadius: 2,
                    },
                },
            }}
        >
            <Typography variant="subtitle2" sx={{ mb: 1.5, opacity: 0.7 }}>
                Стили для «{columnName}»
            </Typography>

            {/* Цвет текста */}
            <Box sx={{ mb: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                    <FormatColorTextIcon fontSize="small" sx={{ opacity: 0.7 }} />
                    <Typography variant="body2">Цвет текста</Typography>
                </Box>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {COLORS.map((c) => (
                        <Tooltip key={c.value || 'none'} title={c.label} arrow>
                            <Box
                                onClick={() => handleColorChange(c.value)}
                                sx={{
                                    width: 24,
                                    height: 24,
                                    backgroundColor: c.value || 'transparent',
                                    borderRadius: '4px',
                                    cursor: 'pointer',
                                    border: currentStyle?.color === c.value
                                        ? '2px solid #fff'
                                        : '1px solid #555',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    '&:hover': {
                                        transform: 'scale(1.15)',
                                        transition: 'transform 0.1s',
                                    },
                                }}
                            >
                                {!c.value && <ClearIcon sx={{ fontSize: 14, opacity: 0.5 }} />}
                            </Box>
                        </Tooltip>
                    ))}
                </Box>
            </Box>

            {/* Цвет фона */}
            <Box sx={{ mb: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                    <FormatColorFillIcon fontSize="small" sx={{ opacity: 0.7 }} />
                    <Typography variant="body2">Цвет фона</Typography>
                </Box>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {COLORS.map((c) => (
                        <Tooltip key={c.value || 'none-bg'} title={c.label} arrow>
                            <Box
                                onClick={() => handleBgColorChange(c.value)}
                                sx={{
                                    width: 24,
                                    height: 24,
                                    backgroundColor: c.value || 'transparent',
                                    borderRadius: '4px',
                                    cursor: 'pointer',
                                    border: currentStyle?.backgroundColor === c.value
                                        ? '2px solid #fff'
                                        : '1px solid #555',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    '&:hover': {
                                        transform: 'scale(1.15)',
                                        transition: 'transform 0.1s',
                                    },
                                }}
                            >
                                {!c.value && <ClearIcon sx={{ fontSize: 14, opacity: 0.5 }} />}
                            </Box>
                        </Tooltip>
                    ))}
                </Box>
            </Box>

            {/* Размер шрифта */}
            <Box sx={{ mb: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                    <FormatSizeIcon fontSize="small" sx={{ opacity: 0.7 }} />
                    <Typography variant="body2">Размер шрифта</Typography>
                </Box>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {FONT_SIZES.map((f) => (
                        <Box
                            key={f.value}
                            onClick={() => handleFontSizeChange(f.value)}
                            sx={{
                                px: 1.5,
                                py: 0.5,
                                backgroundColor: currentStyle?.fontSize === f.value
                                    ? '#555'
                                    : 'transparent',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                border: '1px solid #444',
                                fontSize: 12,
                                '&:hover': {
                                    backgroundColor: '#444',
                                },
                            }}
                        >
                            {f.label}
                        </Box>
                    ))}
                    <Box
                        onClick={() => handleFontSizeChange(null)}
                        sx={{
                            px: 1.5,
                            py: 0.5,
                            backgroundColor: 'transparent',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            border: '1px solid #444',
                            fontSize: 12,
                            opacity: 0.6,
                            '&:hover': {
                                backgroundColor: '#444',
                            },
                        }}
                    >
                        Авто
                    </Box>
                </Box>
            </Box>

            <Divider sx={{ borderColor: '#444', my: 1.5 }} />

            {/* Сбросить все */}
            <Box
                onClick={handleClearStyles}
                sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                    cursor: 'pointer',
                    p: 1,
                    borderRadius: 1,
                    '&:hover': {
                        backgroundColor: 'rgba(239, 68, 68, 0.2)',
                    },
                }}
            >
                <ClearIcon fontSize="small" sx={{ color: '#ef4444' }} />
                <Typography variant="body2" sx={{ color: '#ef4444' }}>
                    Сбросить все стили
                </Typography>
            </Box>
        </Popover>
    );
};