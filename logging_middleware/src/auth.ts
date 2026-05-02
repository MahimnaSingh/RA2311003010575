const TOKEN_URL = "http://20.207.122.201/evaluation-service/auth";
                                                                                                                                                         
  const CREDENTIALS = {                                     
    email: "ms5166@srmist.edu.in",                                                                                                                       
    name: "mahimna singh",                                                                                                                               
    rollNo: "RA2311003010575",
    clientID: "433092a1-edad-4356-adae-ce68164a7325",                                                                                                    
    clientSecret: "kMPxnEsNTPGehNdG",                                                                                                                    
  };                                                                                                                                                     
                                                                                                                                                         
  let cachedToken: string | null = null;                                                                                                                 
  let tokenExpiry: number = 0;                                                                                                                           
                                                            
  export async function getToken(): Promise<string> {                                                                                                    
    if (cachedToken && Date.now() < tokenExpiry) {   
      return cachedToken;                                                                                                                                
    }                                                       
     
    const res = await fetch(TOKEN_URL, {                                                                                                                 
      method: "POST",                   
      headers: { "Content-Type": "application/json" },                                                                                                   
      body: JSON.stringify(CREDENTIALS),                    
    });                                 
       
    const data = (await res.json()) as {
      access_token: string;                                                                                                                              
      expires_in: number;  
    };                                                                                                                                                   
                                                            
    cachedToken = data.access_token;
    tokenExpiry = data.expires_in * 1000;
    return cachedToken;                  
  }