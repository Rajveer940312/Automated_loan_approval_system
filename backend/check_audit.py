import pandas as pd
import os
from supabase import create_client, Client

SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY", "")

def display_audit_log():
    """Connects to Supabase and prints all audit entries."""
    if not SUPABASE_URL or not SUPABASE_KEY:
        print("Missing SUPABASE_URL or SUPABASE_KEY environment variables.")
        return

    try:
        supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
        
        # Read all data directly via Supabase API
        response = supabase.table("loan_audits").select("*").execute()
        
        df = pd.DataFrame(response.data)

        if df.empty:
            print("The loan_audits table is currently empty.")
        else:
            print("--- All Audit Entries ---")
            # Displaying the DataFrame helps visualize the logged data
            print(df) 
            
    except Exception as e:
        print(f"Error accessing Supabase database: {e}")

if __name__ == "__main__":
    display_audit_log()
