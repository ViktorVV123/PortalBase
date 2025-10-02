// src/components/common/SearchBox.tsx
import React from 'react';
import TextField from '@mui/material/TextField';
import InputAdornment from '@mui/material/InputAdornment';
import SearchIcon from '@mui/icons-material/Search';
import IconButton from '@mui/material/IconButton';
import ClearIcon from '@mui/icons-material/Clear';

type Props = {
    value: string;
    onChange: (v: string) => void;
    placeholder?: string;
    autoFocus?: boolean;
    onKeyDown?: React.KeyboardEventHandler; // ← добавили
};

export const SearchBox: React.FC<Props> = ({ value, onChange, placeholder, autoFocus, onKeyDown }) => (
    <TextField
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder={placeholder ?? 'Поиск…'}
        size="small"
        fullWidth
        autoFocus={autoFocus}
        variant="outlined"
        InputProps={{
            startAdornment: (
                <InputAdornment position="start">
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
);
