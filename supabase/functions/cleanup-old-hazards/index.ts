import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Initialize Supabase client with service role key for admin operations
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('🧹 Starting cleanup of old hazard reports...');
    
    // Calculate 24 hours ago timestamp
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    
    // Delete hazard reports older than 24 hours
    // This keeps the database clean and improves performance
    const { data: deletedReports, error } = await supabase
      .from('hazard_reports')
      .delete()
      .lt('created_at', twentyFourHoursAgo)
      .select('id'); // Return deleted IDs for logging

    if (error) {
      console.error('❌ Error during cleanup:', error);
      return new Response(
        JSON.stringify({ 
          error: 'Cleanup failed', 
          details: error.message 
        }), 
        { 
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const deletedCount = deletedReports?.length || 0;
    console.log(`✅ Cleanup completed: ${deletedCount} old hazard reports deleted`);
    
    // Performance optimization: Log cleanup statistics for monitoring
    const result = {
      success: true,
      deletedCount,
      cutoffTime: twentyFourHoursAgo,
      cleanupTimestamp: new Date().toISOString(),
      message: `Successfully deleted ${deletedCount} hazard reports older than 24 hours`
    };

    return new Response(
      JSON.stringify(result),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('❌ Cleanup function error:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error during cleanup',
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
