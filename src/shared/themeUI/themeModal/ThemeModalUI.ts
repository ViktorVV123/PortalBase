import {createTheme} from "@mui/material";

export const dark = createTheme({
    palette:{ mode:'dark', primary:{ main:'#ffffff' } },
    components:{
        MuiOutlinedInput:{ styleOverrides:{ root:{
                    '&.Mui-focused .MuiOutlinedInput-notchedOutline':{ borderColor:'#ffffff' }
                }}},
        MuiInputLabel:{ styleOverrides:{ root:{
                    '&.Mui-focused':{ color:'#ffffff' }
                }}},
        MuiSelect: {
            styleOverrides: {icon: {color: '#ffffff'}},
        },
    },
});