"use client";
export default function GlobalError(){return <html><body><main style={{fontFamily:"system-ui",padding:24,maxWidth:560,margin:"10vh auto"}}><h1>PujaOne is temporarily unavailable</h1><p>Please refresh after a moment. Your previous request will not be duplicated.</p><button onClick={()=>location.reload()} style={{padding:"12px 18px"}}>Refresh</button></main></body></html>}
