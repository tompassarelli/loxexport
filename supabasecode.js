// async function startExportJob() {
//     // Prompt for job name using a simple dialog
//     const jobName = prompt("Please enter a name for this export job:");
//     if (!jobName) {
//         console.log("Export cancelled - name is required");
//         return;
//     }

//     // Create the export job first
//     const { data: job, error: jobError } = await supabase
//         .from('export_jobs')
//         .insert({
//             name: jobName,
//             source: window.location.hostname,
//             status: 'in_progress',
//             metadata: {
//                 startedAt: new Date().toISOString()
//             }
//         })
//         .select()
//         .single();

//     if (jobError) {
//         console.error('Failed to create export job:', jobError);
//         return;
//     }

//     // Now run the extraction
//     const allExtractedData = await extractContactData();

//     // Batch insert records in chunks of 50
//     const BATCH_SIZE = 50;
//     for (let i = 0; i < allExtractedData.length; i += BATCH_SIZE) {
//         const batch = allExtractedData.slice(i, i + BATCH_SIZE);
//         const { error: recordsError } = await supabase
//             .from('export_records')
//             .insert(
//                 batch.map(record => ({
//                     job_id: job.id,
//                     data: record
//                 }))
//             );
        
//         if (recordsError) {
//             console.error(`Error inserting batch ${i/BATCH_SIZE + 1}:`, recordsError);
//         }
        
//         console.log(`Inserted batch ${i/BATCH_SIZE + 1} of ${Math.ceil(allExtractedData.length/BATCH_SIZE)}`);
//     }

//     // Update job status to complete
//     const { error: updateError } = await supabase
//         .from('export_jobs')
//         .update({ 
//             status: 'completed',
//             metadata: {
//                 ...job.metadata,
//                 completedAt: new Date().toISOString(),
//                 totalRecords: allExtractedData.length
//             }
//         })
//         .eq('id', job.id);

//     if (updateError) {
//         console.error('Failed to update job status:', updateError);
//     } else {
//         console.log(`Export job "${jobName}" completed successfully!`);
//     }
// }

// Replace your direct call to extractContactData() with:
// startExportJob();