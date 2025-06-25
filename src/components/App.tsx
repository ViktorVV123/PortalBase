import React, {use, useEffect, useState} from 'react';
import {ErrorBoundary} from "@/components/errorBoundary/ErrorBoundary";
import Main from "@/pages/main/Main";

import {UseLoadConnections} from "@/shared/hooks/UseLoadConnections";
import {useWorkSpaces} from "@/shared/hooks/UseWorkSpaces";
import {Connection} from "@/types/typesConnection";


export const App = () => {
    /* 2. Стейт с корректной типизацией */


    return (
        <ErrorBoundary>
            <div>
                <Main/>
            </div>
        </ErrorBoundary>
    );
};

