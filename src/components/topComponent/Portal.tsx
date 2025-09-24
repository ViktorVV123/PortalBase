import { createPortal } from 'react-dom';
import React from 'react';

export const Portal: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    if (typeof document === 'undefined') return null;
    return createPortal(children, document.body);
};
