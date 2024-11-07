async function extractContactData(cardLimit = null) {
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

      return { name, jobTitle, location, experience, education, skills, specialties, emails: [] };
  }

  // Phase 1: Click all contact buttons first
  async function initiateContactFetch() {
      const tamResultsContainer = document.querySelector('[data-tour="tam-results"]');
      if (!tamResultsContainer) {
          console.error('No container with data-tour="tam-results" found!');
          return [];
      }

      let allExtractedData = [];
      let hasMorePages = true;

      // Iterative approach using while loop instead of recursion
      while (hasMorePages && (!cardLimit || allExtractedData.length < cardLimit)) {
          const personCards = tamResultsContainer.querySelectorAll('[class^="PersonCardContainer-"]');
          const cardsToProcess = cardLimit ? Math.min(cardLimit - allExtractedData.length, personCards.length) : personCards.length;

          // First loop: Click all contact buttons on current page
          for (let i = 0; i < cardsToProcess; i++) {
              const card = personCards[i];
              const contactButton = card.querySelector('[class*="PersonCardContactButtons__ContactButtonInner"]');
              if (contactButton) {
                  contactButton.click();
                  await new Promise(resolve => setTimeout(resolve, 700));
              }
          }

          // Wait for all contact info to load
          await new Promise(resolve => setTimeout(resolve, 8000));

          // Second loop: Extract all data from current page
          for (let i = 0; i < cardsToProcess; i++) {
              const card = personCards[i];
              const cardData = extractCardData(card);

              // Click email icon if present
              const wrapper = card.querySelector('[class*="PersonCardContactButtons__Wrapper"]');
              const btnAnchor = wrapper.querySelector('[class*="Dropdown__AnchorContainer"]');
              if (btnAnchor) {
                  btnAnchor.click();
                  await new Promise(resolve => setTimeout(resolve, 500));
              } else {
                  console.log('Current person card processing has no email, skipping email extract');
                  allExtractedData.push(cardData);
                  continue;
              }

              // Extract email addresses
              const dropdownContainer = document.querySelector('[class*="Dropdown__InternalContainer"]');
              if (dropdownContainer && dropdownContainer.children) {
                  try {
                      cardData.emails = Array.from(dropdownContainer.children).map(row => {
                          const addressElement = row.querySelector('div > span > div > div:first-child');
                          const typeElement = row.querySelector('div > span > div > div:last-child');
                          return {
                              address: addressElement ? addressElement.textContent.trim() : '',
                              type: typeElement ? typeElement.textContent.trim() : ''
                          };
                      }).filter(email => email.address); // Only keep emails with non-empty addresses
                  } catch (error) {
                      console.error('Error extracting email data:', error);
                      cardData.emails = [];
                  }
              } else {
                  cardData.emails = [];
              }
              allExtractedData.push(cardData);

              // Close the email modal
              const cloneButton = dropdownContainer?.querySelector('.fa-clone');
              if (cloneButton && dropdownContainer) {
                  cloneButton.click();
                  await new Promise(resolve => setTimeout(resolve, 1000));
              }
          }

          // Check for next page
          let nextPageButtonIcon = document.querySelector('button i.fa.fa-caret-right.fa-lg');
          let nextPageButton = nextPageButtonIcon ? nextPageButtonIcon.closest('button') : null;

          if (nextPageButton && !nextPageButton.disabled) {
              nextPageButton.click();
              await new Promise(resolve => setTimeout(resolve, 10000)); // Delay before processing the next page
          } else {
              hasMorePages = false;
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
      'Emails',
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
        person.emails.map(e => `${e.address} (${e.type})`).join('; '),
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
    
    // Create and trigger download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'contacts_export.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  });
  
  document.body.appendChild(exportButton);
  return allExtractedData;
}

// Usage examples:
// Extract all cards across all pages:
extractContactData();
// Extract only first 3 cards (like before):
// extractContactData(3);
