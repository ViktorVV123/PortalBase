// src/components/Form/mainTable/CellStyleButton.tsx

import React, { useState } from 'react';
import { IconButton, Tooltip } from '@mui/material';
import PaletteIcon from '@mui/icons-material/Palette';
import { CellStylePopover, CellStyles } from './CellStylePopover';

type CellStyleButtonProps = {
    columnName: string;
    currentStyle: CellStyles | undefined;
    onStyleChange: (columnName: string, style: CellStyles | null) => void;
    disabled?: boolean;
};

export const CellStyleButton: React.FC<CellStyleButtonProps> = ({
                                                                    columnName,
                                                                    currentStyle,
                                                                    onStyleChange,
                                                                    disabled = false,
                                                                }) => {
    const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);

    const hasStyles = currentStyle && Object.keys(currentStyle).length > 0;

    return (
        <>
            <Tooltip title="Настроить стили ячейки" arrow>
                <IconButton
                    size="small"
                    onClick={(e) => {
                        e.stopPropagation();
                        setAnchorEl(e.currentTarget);
                    }}
                    disabled={disabled}
                    sx={{
                        p: 0.25,
                        ml: 0.5,
                        color: hasStyles ? '#f59e0b' : 'rgba(255,255,255,0.4)',
                        '&:hover': {
                            color: '#f59e0b',
                            backgroundColor: 'rgba(245, 158, 11, 0.1)',
                        },
                    }}
                >
                    <PaletteIcon sx={{ fontSize: 16 }} />
                </IconButton>
            </Tooltip>

            <CellStylePopover
                anchorEl={anchorEl}
                onClose={() => setAnchorEl(null)}
                currentStyle={currentStyle}
                onStyleChange={(style) => onStyleChange(columnName, style)}
                columnName={columnName}
            />
        </>
    );
};