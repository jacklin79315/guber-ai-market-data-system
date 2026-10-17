// Password policy for newly provisioned viewer accounts.
// Legacy passwords are not changed by this module.
export function validateNewAccount({username,password}={}){
 const errors=[];
 if(typeof username!=="string"||!/^[a-zA-Z][a-zA-Z0-9_-]{2,39}$/.test(username))errors.push("帳號需為 3–40 個英數、底線或連字號字元，並以英文字母開頭");
 if(typeof password!=="string"||password.length<12||password.length>128)errors.push("密碼長度需為 12–128 個字元");
 if(typeof password==="string"&&(!/[A-Za-z]/.test(password)||!/[0-9]/.test(password)))errors.push("密碼需同時包含英文字母與數字");
 if(typeof username==="string"&&typeof password==="string"&&password.toLowerCase().includes(username.toLowerCase()))errors.push("密碼不得包含帳號名稱");
 return {valid:errors.length===0,errors};
}
