import { NextResponse } from "next/server";
import { requireUser,SESSION_COOKIE } from "@/lib/auth";
import { authorizationResponse } from "@/lib/api-auth";
import { sql } from "@/lib/db";

export async function DELETE(){
  try{const user=await requireUser();await sql(`DELETE FROM pim_v2.sessions WHERE user_id=$1`,[user.id]);const response=NextResponse.json({success:true});response.cookies.set(SESSION_COOKIE,"",{httpOnly:true,sameSite:"lax",secure:true,path:"/",expires:new Date(0)});return response;}
  catch(error){return authorizationResponse(error)??NextResponse.json({error:"Unable to close sessions"},{status:500});}
}
