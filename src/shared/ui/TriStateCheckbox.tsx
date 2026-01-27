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

// ═══════════════════════════════════════════════════════════════════════════
// TRI-STATE CHECKBOX (три состояния: false → true → null)
// ═══════════════════════════════════════════════════════════════════════════

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
                        backgroundColor: 'var(--checkbox-indeterminate-bg)',
                        borderRadius: '4px',
                        padding: '2px',
                        color: 'var(--checkbox-indeterminate)',
                    }}
                />
            }
            checkedIcon={
                <CheckIcon
                    sx={{
                        fontSize: size === 'small' ? 18 : 22,
                        backgroundColor: 'var(--checkbox-checked-bg)',
                        borderRadius: '4px',
                        padding: '2px',
                        color: 'var(--checkbox-checked)',
                    }}
                />
            }
            sx={{
                color: showError ? 'var(--theme-error)' : 'var(--checkbox-unchecked)',
                '&.Mui-checked': {
                    color: showError ? 'var(--theme-error)' : 'var(--checkbox-checked)',
                },
                '&.MuiCheckbox-indeterminate': {
                    color: showError ? 'var(--theme-error)' : 'var(--checkbox-indeterminate)',
                },
                '&.Mui-disabled': {
                    color: 'var(--checkbox-disabled)',
                },
                '&:hover': {
                    backgroundColor: 'var(--checkbox-hover-bg)',
                },
                ...(sx as object),
            }}
        />
    );
};

// ═══════════════════════════════════════════════════════════════════════════
// TRI-STATE CHECKBOX DISPLAY (только чтение)
// ═══════════════════════════════════════════════════════════════════════════

type TriStateCheckboxDisplayProps = {
    value: unknown;
    size?: 'small' | 'medium';
};

/**
 * Компонент для отображения tri-state checkbox в режиме просмотра (только чтение)
 */
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
                        color: 'var(--checkbox-indeterminate)',
                        opacity: 0.7,
                    }}
                />
            }
            sx={{
                color: 'var(--checkbox-unchecked)',
                '&.Mui-checked': {
                    color: 'var(--checkbox-checked)',
                },
                '&.MuiCheckbox-indeterminate': {
                    color: 'var(--checkbox-indeterminate)',
                },
                '&.Mui-disabled': {
                    color: 'var(--checkbox-disabled)',
                    opacity: 0.7,
                },
            }}
        />
    );
};

// ═══════════════════════════════════════════════════════════════════════════
// REGULAR CHECKBOX (обычный, два состояния: false ↔ true)
// ═══════════════════════════════════════════════════════════════════════════

type RegularCheckboxProps = {
    checked: boolean;
    onChange: (checked: boolean) => void;
    disabled?: boolean;
    size?: 'small' | 'medium';
    sx?: SxProps<Theme>;
    /** Показывать ошибку валидации */
    showError?: boolean;
};

/**
 * Обычный двухпозиционный Checkbox:
 * - false (пустой квадрат)
 * - true (галочка ✓)
 */
export const RegularCheckbox: React.FC<RegularCheckboxProps> = ({
                                                                    checked,
                                                                    onChange,
                                                                    disabled = false,
                                                                    size = 'small',
                                                                    sx,
                                                                    showError = false,
                                                                }) => {
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        e.stopPropagation();
        if (disabled) return;
        onChange(e.target.checked);
    };

    const handleClick = (e: React.MouseEvent) => {
        e.stopPropagation();
    };

    return (
        <Checkbox
            size={size}
            checked={checked}
            onChange={handleChange}
            onClick={handleClick}
            disabled={disabled}
            sx={{
                color: showError ? 'var(--theme-error)' : 'var(--checkbox-unchecked)',
                '&.Mui-checked': {
                    color: showError ? 'var(--theme-error)' : 'var(--checkbox-checked)',
                },
                '&.Mui-disabled': {
                    color: 'var(--checkbox-disabled)',
                },
                '&:hover': {
                    backgroundColor: 'var(--checkbox-hover-bg)',
                },
                ...(sx as object),
            }}
        />
    );
};

// ═══════════════════════════════════════════════════════════════════════════
// REGULAR CHECKBOX DISPLAY (только чтение)
// ═══════════════════════════════════════════════════════════════════════════

type RegularCheckboxDisplayProps = {
    checked: boolean;
    size?: 'small' | 'medium';
};

/**
 * Компонент для отображения обычного checkbox в режиме просмотра (только чтение)
 */
export const RegularCheckboxDisplay: React.FC<RegularCheckboxDisplayProps> = ({
                                                                                  checked,
                                                                                  size = 'small',
                                                                              }) => {
    return (
        <Checkbox
            size={size}
            checked={checked}
            disabled
            sx={{
                color: 'var(--checkbox-unchecked)',
                '&.Mui-checked': {
                    color: 'var(--checkbox-checked)',
                },
                '&.Mui-disabled': {
                    color: 'var(--checkbox-disabled)',
                    opacity: 0.7,
                },
            }}
        />
    );
};