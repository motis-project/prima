export let emailstring = "";

export const writeEmailString = (email: string) => {
    emailstring = email;
};

export const getEmailString = (): string => {
    return emailstring;
};