import { Log } from "./index";                                                                                                                         
                                                                                                                                                         
  Log("backend", "info", "config", "logging middleware initialized successfully").then(() => {                                                           
    process.stdout.write("log sent successfully\n");                                                                                                     
  });