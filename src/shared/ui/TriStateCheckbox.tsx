// src/components/Form/mainTable/TriStateCheckbox.tsx

import React from 'react';
import { Checkbox, SxProps, Theme } from '@mui/material';
import QuestionMarkIcon from '@mui/icons-material/QuestionMark';
import CheckIcon from '@mui/icons-material/Check';

export type TriStateValue = 'true' | 'false' | 'null' | '' | null | undefined | string;

/**
 * Нормализует входное значение к одному из трёх состояний: 'true' | 'false' | 'null'
 */
export function normalizeTriState(value: unknown): 'true' | 'false' | 'null' {
    if (value === null || value === 'null' || value === undefined || value === '') {
        return 'null';
    }

    if (value === true || value === 'true' || value === '1' || value === 't' || value === 'T' || value === 'yes' || value === 'да') {
        return 'true';
    }

    return 'false';
}

/**
 * Возвращает следующее состояние при клике: false → true → null → false
 */
export function getNextTriState(current: 'true' | 'false' | 'null'): 'true' | 'false' | 'null' {
    switch (current) {
        case 'false':
            return 'true';
        case 'true':
            return 'null';
        case 'null':
            return 'false';
        default:
            return 'false';
    }
}

/**
 * Преобразует tristate в значение для отправки на бэкенд
 */
export function triStateToBackendValue(state: 'true' | 'false' | 'null'): string | null {
    switch (state) {
        case 'true':
            return 'true';
        case 'false':
            return 'false';
        case 'null':
            return null;
    }
}

type TriStateCheckboxProps = {
    value: TriStateValue;
    onChange: (newValue: 'true' | 'false' | 'null') => void;
    disabled?: boolean;
    size?: 'small' | 'medium';
    sx?: SxProps<Theme>;
    /** Показывать ошибку валидации */
    showError?: boolean;
};

/**
 * Трёхпозиционный Checkbox:
 * - false (пустой квадрат)
 * - true (галочка ✓)
 * - null (знак вопроса ?)
 */
export const TriStateCheckbox: React.FC<TriStateCheckboxProps> = ({
                                                                      value,
                                                                      onChange,
                                                                      disabled = false,
                                                                      size = 'small',
                                                                      sx,
                                                                      showError = false,
                                                                  }) => {
    const state = normalizeTriState(value);

    const handleClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (disabled) return;

        const next = getNextTriState(state);
        onChange(next);
    };

    // Определяем визуальное состояние
    const isChecked = state === 'true';
    const isIndeterminate = state === 'null';

    // Базовые стили
    const baseSx: SxProps<Theme> = {
        color: showError ? '#ef4444' : 'rgba(255, 255, 255, 0.4)',
        '&.Mui-checked': {
            color: showError ? '#ef4444' : 'rgba(255, 255, 255, 0.9)'
        },
        '&.MuiCheckbox-indeterminate': {
            color: showError ? '#ef4444' : '#ffb74d' // Оранжевый для null
        },
        '&.Mui-disabled': {
            color: 'rgba(255, 255, 255, 0.3)'
        },
        ...sx,
    };

    return (
        <Checkbox
            size={size}
            checked={isChecked}
            indeterminate={isIndeterminate}
            onClick={handleClick}
            disabled={disabled}
            indeterminateIcon={
                <QuestionMarkIcon
                    sx={{
                        fontSize: size === 'small' ? 18 : 22,
                        backgroundColor: 'rgba(255, 183, 77, 0.2)',
                        borderRadius: '4px',
                        padding: '2px',
                    }}
                />
            }
            checkedIcon={
                <CheckIcon
                    sx={{
                        fontSize: size === 'small' ? 18 : 22,
                        backgroundColor: 'rgba(102, 187, 106, 0.2)',
                        borderRadius: '4px',
                        padding: '2px',
                    }}
                />
            }
            sx={baseSx}
        />
    );
};

/**
 * Компонент для отображения checkbox в режиме просмотра (только чтение)
 */
type TriStateCheckboxDisplayProps = {
    value: unknown;
    size?: 'small' | 'medium';
};

export const TriStateCheckboxDisplay: React.FC<TriStateCheckboxDisplayProps> = ({
                                                                                    value,
                                                                                    size = 'small',
                                                                                }) => {
    const state = normalizeTriState(value);

    const isChecked = state === 'true';
    const isIndeterminate = state === 'null';

    return (
        <Checkbox
            size={size}
            checked={isChecked}
            indeterminate={isIndeterminate}
            disabled
            indeterminateIcon={
                <QuestionMarkIcon
                    sx={{
                        fontSize: size === 'small' ? 18 : 22,
                        color: '#ffb74d',
                        opacity: 0.7,
                    }}
                />
            }
            sx={{
                color: 'rgba(255, 255, 255, 0.4)',
                '&.Mui-checked': { color: 'rgba(255, 255, 255, 0.9)' },
                '&.MuiCheckbox-indeterminate': { color: '#ffb74d' },
                '&.Mui-disabled': { color: 'rgba(255, 255, 255, 0.7)' },
            }}
        />
    );
};