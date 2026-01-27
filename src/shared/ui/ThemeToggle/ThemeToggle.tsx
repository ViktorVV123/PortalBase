// src/shared/ui/ThemeToggle/ThemeToggle.tsx
// ═══════════════════════════════════════════════════════════════════════════
// Кнопка переключения темы с анимацией солнца/луны
// ═══════════════════════════════════════════════════════════════════════════

import React, { useState } from 'react';
import { useTheme, ThemeMode } from '@/shared/theme/ThemeContext';
import { Tooltip, Popover, Box, Typography, ToggleButtonGroup, ToggleButton } from '@mui/material';
import LightModeIcon from '@mui/icons-material/LightMode';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import SettingsBrightnessIcon from '@mui/icons-material/SettingsBrightness';

// ═══════════════════════════════════════════════════════════════════════════
// ТИПЫ
// ═══════════════════════════════════════════════════════════════════════════

type ThemeToggleProps = {
    /** Дополнительный класс */
    className?: string;
    /** Показывать расширенное меню с выбором режима */
    showModeSelector?: boolean;
    /** Размер кнопки */
    size?: 'small' | 'medium' | 'large';
};

// ═══════════════════════════════════════════════════════════════════════════
// РАЗМЕРЫ
// ═══════════════════════════════════════════════════════════════════════════

const SIZES = {
    small: { button: 32, icon: 18 },
    medium: { button: 40, icon: 22 },
    large: { button: 48, icon: 26 },
};

// ═══════════════════════════════════════════════════════════════════════════
// КОМПОНЕНТ
// ═══════════════════════════════════════════════════════════════════════════

export const ThemeToggle: React.FC<ThemeToggleProps> = ({
                                                            className,
                                                            showModeSelector = true,
                                                            size = 'medium',
                                                        }) => {
    const { mode, resolvedTheme, setMode, toggle, isDark } = useTheme();
    const [anchorEl, setAnchorEl] = useState<HTMLButtonElement | null>(null);

    const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
        if (showModeSelector) {
            setAnchorEl(event.currentTarget);
        } else {
            toggle();
        }
    };

    const handleClose = () => {
        setAnchorEl(null);
    };

    const handleModeChange = (_: React.MouseEvent<HTMLElement>, newMode: ThemeMode | null) => {
        if (newMode) {
            setMode(newMode);
            handleClose();
        }
    };

    const open = Boolean(anchorEl);
    const sizeConfig = SIZES[size];

    const tooltipTitle = isDark ? 'Переключить на светлую тему' : 'Переключить на тёмную тему';

    return (
        <>
            <Tooltip title={tooltipTitle} arrow>
                <button
                    className={className}
                    onClick={handleClick}
                    aria-label={tooltipTitle}
                    style={{
                        position: 'relative',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: sizeConfig.button,
                        height: sizeConfig.button,
                        background: 'var(--theme-surface)',
                        border: '1px solid var(--theme-border)',
                        borderRadius: '50%',
                        cursor: 'pointer',
                        transition: 'background-color 0.2s ease, border-color 0.2s ease, transform 0.15s ease',
                        overflow: 'hidden',
                    }}
                    onMouseEnter={(e) => {
                        e.currentTarget.style.transform = 'scale(1.05)';
                        e.currentTarget.style.background = 'var(--theme-hover)';
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.transform = 'scale(1)';
                        e.currentTarget.style.background = 'var(--theme-surface)';
                    }}
                >
                    {/* Солнце */}
                    <span
                        style={{
                            position: 'absolute',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#FFA726',
                            opacity: isDark ? 0 : 1,
                            transform: isDark ? 'rotate(-90deg) scale(0.5)' : 'rotate(0) scale(1)',
                            transition: 'opacity 0.3s ease, transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
                        }}
                    >
                        <LightModeIcon style={{ fontSize: sizeConfig.icon }} />
                    </span>
                    {/* Луна */}
                    <span
                        style={{
                            position: 'absolute',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#90CAF9',
                            opacity: isDark ? 1 : 0,
                            transform: isDark ? 'rotate(0) scale(1)' : 'rotate(90deg) scale(0.5)',
                            transition: 'opacity 0.3s ease, transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
                        }}
                    >
                        <DarkModeIcon style={{ fontSize: sizeConfig.icon }} />
                    </span>
                </button>
            </Tooltip>

            {showModeSelector && (
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
                            sx: {
                                backgroundColor: 'var(--dropdown-bg)',
                                border: '1px solid var(--dropdown-border)',
                                borderRadius: '12px',
                                p: 2,
                                minWidth: 200,
                                boxShadow: 'var(--shadow-2)',
                            },
                        },
                    }}
                >
                    <Box>
                        <Typography
                            variant="subtitle2"
                            sx={{
                                color: 'var(--dropdown-text)',
                                fontWeight: 600,
                                mb: 1.5,
                                textAlign: 'center',
                            }}
                        >
                            Тема оформления
                        </Typography>

                        <ToggleButtonGroup
                            value={mode}
                            exclusive
                            onChange={handleModeChange}
                            aria-label="Выбор темы"
                            fullWidth
                            sx={{
                                '& .MuiToggleButton-root': {
                                    color: 'var(--theme-text-secondary)',
                                    borderColor: 'var(--theme-border)',
                                    textTransform: 'none',
                                    fontSize: 13,
                                    py: 1,
                                    '&:hover': {
                                        backgroundColor: 'var(--theme-hover)',
                                    },
                                    '&.Mui-selected': {
                                        color: 'var(--theme-primary)',
                                        backgroundColor: 'var(--theme-focus)',
                                        borderColor: 'var(--theme-primary)',
                                        '&:hover': {
                                            backgroundColor: 'var(--theme-focus)',
                                        },
                                    },
                                },
                            }}
                        >
                            <ToggleButton value="light" aria-label="Светлая тема">
                                <LightModeIcon sx={{ fontSize: 18, mr: 0.5, color: '#FFA726' }} />
                                Светлая
                            </ToggleButton>
                            <ToggleButton value="dark" aria-label="Тёмная тема">
                                <DarkModeIcon sx={{ fontSize: 18, mr: 0.5, color: '#90CAF9' }} />
                                Тёмная
                            </ToggleButton>
                            <ToggleButton value="system" aria-label="Системная тема">
                                <SettingsBrightnessIcon sx={{ fontSize: 18, mr: 0.5 }} />
                                Авто
                            </ToggleButton>
                        </ToggleButtonGroup>

                        {mode === 'system' && (
                            <Typography
                                variant="caption"
                                sx={{
                                    display: 'block',
                                    color: 'var(--theme-text-muted)',
                                    textAlign: 'center',
                                    mt: 1.5,
                                    fontSize: 11,
                                }}
                            >
                                Сейчас: {resolvedTheme === 'dark' ? 'тёмная' : 'светлая'}
                            </Typography>
                        )}
                    </Box>
                </Popover>
            )}
        </>
    );
};

export default ThemeToggle;