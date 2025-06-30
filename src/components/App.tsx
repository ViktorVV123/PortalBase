import React, {use, useEffect, useState} from 'react';
import {ErrorBoundary} from "@/components/errorBoundary/ErrorBoundary";
import {Main} from "@/pages/main/Main";

export const App = () => {

    return (
        <ErrorBoundary>
            <div>
                <Main/>
            </div>
        </ErrorBoundary>
    );
};

