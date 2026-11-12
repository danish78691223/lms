import React,{createContext,useContext,useEffect,useState} from "react";import{api}from"../api";
const C=createContext(null);export const useAuth=()=>useContext(C);
export function AuthProvider({children}){const[user,setUser]=useState(null),[loading,setLoading]=useState(true);
 useEffect(()=>{api("/auth/me").then(x=>setUser(x.user)).catch(()=>setUser(null)).finally(()=>setLoading(false))},[]);
 const login=async(userId,password)=>{const x=await api("/auth/login",{method:"POST",body:JSON.stringify({userId,password})});setUser(x.user);return x.user};
 const logout=async()=>{await api("/auth/logout",{method:"POST"});setUser(null)};
 return <C.Provider value={{user,setUser,login,logout,loading}}>{children}</C.Provider>}
