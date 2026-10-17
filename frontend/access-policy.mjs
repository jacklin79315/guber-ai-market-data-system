// V2 access-control policy. Deny unknown roles and actions by default.
// Authorization must be checked by the server, not merely by hiding UI buttons.
export const ROLES=Object.freeze({ADMIN:"admin",VIEWER:"viewer"});
export const PERMISSIONS=Object.freeze({
 "market:read":["admin","viewer"],
 "quality:read":["admin","viewer"],
 "signals:read":["admin","viewer"],
 "training:read":["admin","viewer"],
 "models:read":["admin","viewer"],
 "notifications:read":["admin","viewer"],
 "training:manage":["admin"],
 "experts:manage":["admin"],
 "models:manage":["admin"],
 "users:manage":["admin"],
 "settings:manage":["admin"]
});
export function can(role,permission){return Object.hasOwn(PERMISSIONS,permission)&&PERMISSIONS[permission].includes(role)}
export function publicIdentity(user,role){if(!user||typeof user.id!=="string"||!["admin","viewer"].includes(role))return null;return {id:user.id,role,permissions:Object.keys(PERMISSIONS).filter(p=>can(role,p))}}
