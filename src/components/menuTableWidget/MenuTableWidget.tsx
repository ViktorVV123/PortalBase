import React from 'react';

type MenuTableWidgetProps = {
    setSwapTableWidget: (value: number) => void;
};

export const MenuTableWidget = ({ setSwapTableWidget }: MenuTableWidgetProps) => (
    <div style={{ display: 'flex', gap: 20, justifyContent: 'center', cursor: 'pointer' }}>
        <h4 onClick={() => setSwapTableWidget(0)}>Table</h4>
        <h4 onClick={() => setSwapTableWidget(1)}>Widget</h4>
    </div>
);
