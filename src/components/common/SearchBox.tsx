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
    /** ширины анимации (можно не трогать) */
    collapsedWidth?: number;   // px
    expandedWidth?: number;    // px
};

export const SearchBox: React.FC<Props> = ({
                                               value,
                                               onChange,
                                               placeholder = 'Search',
                                               autoFocus,
                                               onKeyDown,
                                               collapsedWidth = 180,
                                               expandedWidth = 180
                                           }) => {
    const [focused, setFocused] = useState(false);
    const expanded = focused || !!value;

    const styleVars = useMemo(
        () => ({
            // прокидываем в css-переменные контейнера
            ['--collapsed' as any]: `${collapsedWidth}px`,
            ['--expanded' as any]: `${expandedWidth}px`,
        }),
        [collapsedWidth, expandedWidth]
    );

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
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
                // ширину управляем обёрткой, поэтому fullWidth не нужен
                sx={{
                    '& .MuiOutlinedInput-root': {
                        borderRadius: 9999,
                        backgroundColor: '#444545',
                        // делаем похожий на скрин вид
                        '& fieldset': { borderColor: '#e5e8ef' },
                        '&:hover fieldset': { borderColor: '#d5dbe7' },
                        '&.Mui-focused fieldset': { borderColor: '#c7cfdd' },
                        fontSize: 16,
                        paddingRight: 0
                    },
                    '& .MuiInputAdornment-root': { color: '#eff0f1' }, // серый для иконок
                    minWidth: 0   // чтобы не было минимальной ширины от MUI
                }}
                InputProps={{
                    startAdornment: (
                        <InputAdornment position="start" sx={{ ml: .5 }}>
                            <SearchIcon fontSize="small" />
                        </InputAdornment>
                    ),
                    endAdornment: value ? (
                        <InputAdornment position="end">
                            <IconButton size="small" onClick={() => onChange('')}>
                                <ClearIcon fontSize="small" />
                            </IconButton>
                        </InputAdornment>
                    ) : undefined
                }}
            />
        </div>
    );
};
