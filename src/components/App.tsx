import React from 'react';
import {ErrorBoundary} from "@/components/errorBoundary/ErrorBoundary";
import {Main} from "@/pages/main/Main";
import {WorkspaceProvider} from "@/shared/context/WorkspaceContext";

export const App = () => {

    return (
        <ErrorBoundary>
            <WorkspaceProvider>
                <div>
                    <Main/>
                </div>
            </WorkspaceProvider>
        </ErrorBoundary>
    );
};

