import { getToken } from "./auth";                                                                                                                     
                                    
  const LOG_URL = "http://20.207.122.201/evaluation-service/logs";                                                                                       
                                                                                                                                                         
  type Stack = "backend" | "frontend";
  type Level = "debug" | "info" | "warn" | "error" | "fatal";                                                                                            
  type Package =                                             
    | "cache" | "controller" | "cron_job" | "db" | "domain"                                                                                              
    | "handler" | "repository" | "route" | "service"       
    | "auth" | "config" | "middleware" | "utils"                                                                                                         
    | "api" | "component" | "hook" | "page" | "state" | "style";
                                                                                                                                                         
  export async function Log(                                                                                                                             
    stack: Stack,                                                                                                                                        
    level: Level,                                                                                                                                        
    pkg: Package,                                           
    message: string
  ): Promise<void> {                                                                                                                                     
    try {           
      const token = await getToken();                                                                                                                    
      await fetch(LOG_URL, {                                
        method: "POST",     
        headers: {     
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,                                                                                                              
        },                                 
        body: JSON.stringify({ stack, level, package: pkg, message }),                                                                                   
      });                                                             
    } catch (err) {
      throw new Error(`logging failed: ${err}`);                                                                                                         
    }
  }