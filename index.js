async function extractContactData(cardLimit = null, paginateOnly = false) {
  // Function to extract data from a single card
  function extractCardData(card) {
      const querySelector = (selector) => card.querySelector(`[class*="${selector}"]`);
      const querySelectorAll = (selector) => card.querySelectorAll(`[class*="${selector}"]`);

      const name = querySelector('PersonCardName')?.textContent.trim();
      const jobTitle = querySelector('PersonCardJobTitle')?.textContent.trim();
      const location = querySelector('PersonCardLocation')?.textContent.trim();
      
      const experience = Array.from(querySelectorAll('PersonCardJobItem__Container')).map(job => ({
          title: job.querySelector('[class*="PersonCardJobItem__Title"]')?.textContent.trim(),
          company: job.querySelector('[class*="PersonCardJobItem__InfoArea"]')?.childNodes[1]?.textContent.trim(),
          duration: job.querySelector('.Deemphasize-sc')?.textContent.trim()
      }));
      
      const education = Array.from(querySelectorAll('PersonCardEducationItem__Container')).map(edu => ({
          institution: edu.querySelector('[class*="PersonCardEducationItem__InstitutionName"]')?.textContent.trim(),
          degree: edu.querySelector('[class*="PersonCardEducationItem__InfoArea"] span:not(.Deemphasize-sc)')?.textContent.trim(),
          duration: edu.querySelector('.Deemphasize-sc')?.textContent.trim()
      }));
      
      const badgeSections = Array.from(querySelectorAll('PersonCardBadgesSection__Container'));
      
      const skillsContainer = badgeSections.find(el => el.textContent.includes('Skills'));
      const skills = skillsContainer ? Array.from(skillsContainer.querySelectorAll('[class*="PersonCardBadgesSection__StyledBadge"]')).map(skill => skill.textContent.trim()) : [];
      
      const specialtiesContainer = badgeSections.find(el => el.textContent.includes('Specialties'));
      const specialties = specialtiesContainer ? Array.from(specialtiesContainer.querySelectorAll('[class*="PersonCardBadgesSection__StyledBadge"]')).map(specialty => specialty.textContent.trim()) : [];

      return { name, jobTitle, location, experience, education, skills, specialties, personalEmail: '', workEmail: '' };
  }

  // Remove toast notifications from appearing on the page
  document.querySelector('[class*="toaster__ToastWrapper"]').remove();

  // Phase 1: Click all contact buttons first
  async function initiateContactFetch() {
      const tamResultsContainer = document.querySelector('[data-tour="tam-results"]');
      if (!tamResultsContainer) {
          console.error('No container with data-tour="tam-results" found!');
          return [];
      }

      // Add new helper function for pagination
      async function clickNextPage() {
          const nextPageButton = document.querySelector('._8y7hx9b > button:nth-child(4)');
          
          if (nextPageButton && !nextPageButton.disabled) {
              try {
                  nextPageButton.click();
                  await new Promise(resolve => setTimeout(resolve, 10000));
                  return true;
              } catch (error) {
                  console.error('Click failed:', error);
                  return false;
              }
          }
          return false;
      }

      let allExtractedData = [];
      let hasMorePages = true;

      // If paginateOnly is true, just click through all pages without extracting data
      if (paginateOnly) {
          while (hasMorePages) {
              hasMorePages = await clickNextPage();
          }
          console.log('Pagination test completed');
          return [];
      }

      // Iterative approach using while loop instead of recursion
      while (hasMorePages && (!cardLimit || allExtractedData.length < cardLimit)) {
          const personCards = tamResultsContainer.querySelectorAll('[class^="PersonCardContainer-"]');
          const cardsToProcess = cardLimit ? Math.min(cardLimit - allExtractedData.length, personCards.length) : personCards.length;

          // First loop: Click all contact buttons on current page
          console.log(`Starting contact button clicks for ${cardsToProcess} cards...`);
          for (let i = 0; i < cardsToProcess; i++) {
              const card = personCards[i];
              const contactButton = card.querySelector('[class*="PersonCardContactButtons__ContactButtonInner"]');
              if (contactButton) {
                  console.log(`Clicking contact button ${i + 1}/${cardsToProcess}`);
                  contactButton.click();
                  await new Promise(resolve => setTimeout(resolve, 1100));
              }
          }
          console.log('Finished clicking contact buttons, waiting for data load...');

          // Wait for all contact info to load
          await new Promise(resolve => setTimeout(resolve, 15000));

          // Second loop: Extract all data from current page
          for (let i = 0; i < cardsToProcess; i++) {
              const card = personCards[i];
              const cardData = extractCardData(card);

              // Click email icon if present
              const wrapper = card.querySelector('[class*="PersonCardContactButtons__Wrapper"]');
              const btnAnchor = wrapper.querySelector('[class*="Dropdown__AnchorContainer"]');
              if (btnAnchor) {
                  btnAnchor.click();
                  await new Promise(resolve => setTimeout(resolve, 1100));
              } else {
                  console.log('Current person card processing has no email, skipping email extract');
                  allExtractedData.push(cardData);
                  continue;
              }

              // Extract email addresses
              const dropdownContainer = document.querySelector('[class*="Dropdown__InternalContainer"]');
              if (dropdownContainer && dropdownContainer.children) {
                  try {
                      const emailRows = Array.from(dropdownContainer.children);
                      for (const row of emailRows) {
                          const addressElement = row.querySelector('div > span > div > div:first-child');
                          const typeElement = row.querySelector('div > span > div > div:last-child');
                          const emailAddress = addressElement ? addressElement.textContent.trim() : '';
                          const emailType = typeElement ? typeElement.textContent.trim().toLowerCase() : '';
                          
                          if (emailAddress) {
                              if (emailType.includes('work')) {
                                  cardData.workEmail = emailAddress;
                              } else if (emailType.includes('personal')) {
                                  cardData.personalEmail = emailAddress;
                              }
                          }
                      }
                  } catch (error) {
                      console.error('Error extracting email data:', error);
                  } finally {
                      console.log('Email extraction complete');
                  }
              } else {
                  cardData.emails = [];
              }
              allExtractedData.push(cardData);

              // Close the email modal
              const cloneButton = dropdownContainer?.querySelector('.fa-clone');
              if (cloneButton && dropdownContainer) {
                  cloneButton.click();
                  await new Promise(resolve => setTimeout(resolve, 1100));
              }
          }

          // Check for next page and navigate if possible
          hasMorePages = await clickNextPage();
          if (!hasMorePages) {
              console.log('Completed processing all pages.');
          }
      }

      return allExtractedData;
  }

  const allExtractedData = await initiateContactFetch();
  console.log('Extracted data:', allExtractedData);
  
  // Create export button
  const exportButton = document.createElement('button');
  exportButton.innerHTML = 'Export to CSV';
  exportButton.style.cssText = 'position: fixed; bottom: 20px; right: 20px; z-index: 9999; padding: 10px 20px; background: #4CAF50; color: white; border: none; border-radius: 4px; cursor: pointer;';
  
  exportButton.addEventListener('click', () => {
    // Convert data to CSV with all fields
    const headers = [
      'Name',
      'Job Title',
      'Location',
      'Skills',
      'Specialties',
      'Personal Email',
      'Work Email',
      'Current Title',
      'Current Company',
      'Current Duration',
      'Previous Titles',
      'Previous Companies',
      'Previous Durations',
      'Education Institutions',
      'Education Degrees',
      'Education Durations'
    ];
    
    const rows = [headers];
    
    allExtractedData.forEach(person => {
      // Get current role (first experience entry)
      const currentRole = person.experience[0] || {};
      
      // Get previous roles (all except first)
      const previousRoles = person.experience.slice(1);
      
      rows.push([
        person.name,
        person.jobTitle || '',
        person.location || '',
        person.skills.join('; '),
        person.specialties.join('; '),
        person.personalEmail || '',
        person.workEmail || '',
        currentRole.title || '',
        currentRole.company || '',
        currentRole.duration || '',
        previousRoles.map(role => role.title).join('; '),
        previousRoles.map(role => role.company).join('; '),
        previousRoles.map(role => role.duration).join('; '),
        person.education.map(edu => edu.institution).join('; '),
        person.education.map(edu => edu.degree).join('; '),
        person.education.map(edu => edu.duration).join('; ')
      ]);
    });
    
    const csvContent = rows.map(row => row.map(cell => 
      `"${(cell || '').toString().replace(/"/g, '""')}"`
    ).join(',')).join('\n');
    
    // Create and trigger download using data URL instead of Blob
    const csvData = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', csvData);
    link.setAttribute('download', 'contacts_export.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  });
  
  document.body.appendChild(exportButton);
  return allExtractedData;
}

// Usage examples:
// Extract all cards across all pages:
extractContactData();
// Extract only first 3 cards (like before):
// extractContactData(3);
