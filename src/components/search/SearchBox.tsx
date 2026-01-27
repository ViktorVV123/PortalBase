// src/components/search/SearchBox.tsx
// Поддержка светлой и тёмной темы

import React, { useMemo, useState } from 'react';
import TextField from '@mui/material/TextField';
import InputAdornment from '@mui/material/InputAdornment';
import IconButton from '@mui/material/IconButton';
import SearchIcon from '@mui/icons-material/Search';
import ClearIcon from '@mui/icons-material/Clear';
import * as cls from './SearchBox.module.scss';

type Props = {
    value: string;
    onChange: (v: string) => void;
    placeholder?: string;
    autoFocus?: boolean;
    onKeyDown?: React.KeyboardEventHandler;
    onFocus?: () => void;
    onBlur?: () => void;
    collapsedWidth?: number;
    expandedWidth?: number;
};

export const SearchBox: React.FC<Props> = ({
                                               value,
                                               onChange,
                                               placeholder = 'Search',
                                               autoFocus,
                                               onKeyDown,
                                               onFocus,
                                               onBlur,
                                               collapsedWidth = 180,
                                               expandedWidth = 180
                                           }) => {
    const [focused, setFocused] = useState(false);
    const expanded = focused || !!value;

    const styleVars = useMemo(
        () => ({
            ['--collapsed' as any]: `${collapsedWidth}px`,
            ['--expanded' as any]: `${expandedWidth}px`,
        }),
        [collapsedWidth, expandedWidth]
    );

    const handleFocus = () => {
        setFocused(true);
        onFocus?.();
    };

    const handleBlur = () => {
        setFocused(false);
        onBlur?.();
    };

    return (
        <div
            className={cls.container}
            data-expanded={expanded ? '1' : '0'}
            style={styleVars as React.CSSProperties}
        >
            <TextField
                value={value}
                onChange={(e) => onChange(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder={placeholder}
                size="small"
                autoFocus={autoFocus}
                variant="outlined"
                onFocus={handleFocus}
                onBlur={handleBlur}
                sx={{
                    width: '100%',
                    '& .MuiOutlinedInput-root': {
                        borderRadius: 9999,
                        backgroundColor: 'var(--search-bg, #F1F3F4)',
                        transition: 'background-color 0.2s ease, border-color 0.2s ease',
                        '& fieldset': {
                            borderColor: 'var(--search-border, transparent)',
                        },
                        '&:hover fieldset': {
                            borderColor: 'var(--theme-border, rgba(0, 0, 0, 0.12))',
                        },
                        '&.Mui-focused': {
                            backgroundColor: 'var(--search-bg-focus, #FFFFFF)',
                            '& fieldset': {
                                borderColor: 'var(--search-border-focus, var(--theme-primary))',
                            },
                        },
                        fontSize: 14,
                        paddingRight: 0,
                    },
                    '& .MuiInputBase-input': {
                        color: 'var(--search-text, #1A1A1A)',
                        '&::placeholder': {
                            color: 'var(--search-placeholder, #9AA0A6)',
                            opacity: 1,
                        },
                    },
                    '& .MuiInputAdornment-root': {
                        color: 'var(--icon-secondary, #9AA0A6)',
                    },
                    minWidth: 0,
                }}
                InputProps={{
                    startAdornment: (
                        <InputAdornment position="start" sx={{ ml: 0.5 }}>
                            <SearchIcon fontSize="small" />
                        </InputAdornment>
                    ),
                    endAdornment: value ? (
                        <InputAdornment position="end">
                            <IconButton
                                size="small"
                                onClick={() => onChange('')}
                                sx={{
                                    color: 'var(--icon-secondary, #9AA0A6)',
                                    '&:hover': {
                                        color: 'var(--icon-primary, #5F6368)',
                                        backgroundColor: 'var(--theme-hover, rgba(0, 0, 0, 0.04))',
                                    },
                                }}
                            >
                                <ClearIcon fontSize="small" />
                            </IconButton>
                        </InputAdornment>
                    ) : undefined
                }}
            />
        </div>
    );
};