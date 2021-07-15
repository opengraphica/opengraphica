
let objectUrlUsers = new Map();

export function resetObjectUrlUsers() {
    objectUrlUsers = new Map();
}

export function registerObjectUrlUser(objectUrl: any, user: any) {
    objectUrl = objectUrl.toString();
    if (objectUrl) {
        let existingUsers = objectUrlUsers.get(objectUrl) || [];
        if (!existingUsers.includes(user)) {
            existingUsers.push(user);
        }
        objectUrlUsers.set(objectUrl, existingUsers);
    }
}

export function unregisterObjectUrlUser(objectUrl: any, user: any) {
    objectUrl = objectUrl.toString();
    let existingUsers = objectUrlUsers.get(objectUrl) || [];
    existingUsers.splice(existingUsers.indexOf(user), 1);
    if (existingUsers.length === 0) {
        objectUrlUsers.delete(objectUrl);
    } else {
        objectUrlUsers.set(objectUrl, existingUsers);
    }
}

export function objectUrlHasUsers(objectUrl: any) {
    objectUrl = objectUrl.toString();
    return (objectUrlUsers.get(objectUrl) || []).length > 0;
}

export function revokeObjectUrlIfLastUser(objectUrl: any, user: any) {
    objectUrl = objectUrl.toString();
    unregisterObjectUrlUser(objectUrl, user);
    if (!objectUrlHasUsers) {
        URL.revokeObjectURL(objectUrl);
    }
}
