class ContactExtractor {
  constructor(cardLimit = null, paginateOnly = false) {
      this.cardLimit = cardLimit;
      this.paginateOnly = paginateOnly;
      this.allExtractedData = [];
  }

  static removeToastNotifications() {
      document.querySelector('[class*="toaster__ToastWrapper"]')?.remove();
  }

  extractCardData(card) {
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

  async clickNextPage() {
      const nextPageButton = document.querySelector('._8y7hx9b > button:nth-child(4)');
      
      if (nextPageButton && !nextPageButton.disabled) {
          try {
              nextPageButton.click();
              // Initial 15 second delay to avoid race conditions with existing cards
              await new Promise(resolve => setTimeout(resolve, 15000));
              
              // Wait for new person cards to appear (up to 1 minute)
              await new Promise((resolve, reject) => {
                  const startTime = Date.now();
                  const checkForCards = setInterval(() => {
                      const personCards = document.querySelector('[class^="PersonCardContainer-"]');
                      const elapsedTime = Date.now() - startTime;
                      
                      if (personCards) {
                          console.log(`New cards loaded after ${(elapsedTime + 15000)/1000} seconds`);
                          clearInterval(checkForCards);
                          resolve();
                      } else if (elapsedTime >= 60000) { // 1 min timeout
                          console.log('Timed out waiting for new cards');
                          clearInterval(checkForCards);
                          reject(new Error('Timed out waiting for new cards'));
                      }
                  }, 1000); // Check every second
              });
              return true;
          } catch (error) {
              console.error('Page navigation failed:', error);
              return false;
          }
      }
      return false;
  }

  async extractEmailsFromDropdown(cardData) {
      const dropdownContainer = document.querySelector('[class*="Dropdown__InternalContainer"]');
      if (!dropdownContainer?.children) return;

      try {
          const emailRows = Array.from(dropdownContainer.children);
          for (const row of emailRows) {
              const addressElement = row.querySelector('div > span > div > div:first-child');
              const typeElement = row.querySelector('div > span > div > div:last-child');
              const emailAddress = addressElement?.textContent.trim();
              const emailType = typeElement?.textContent.trim().toLowerCase();
              
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
      }
  }

  async processCard(card) {
      // Check if card is still loading contacts by looking for LoadingStateLayer
      const isLoading = card.querySelector('[class*="LoadingStateLayer_"]');
      if (isLoading) {
          console.log('Card is still loading contacts, will retry for up to 10 seconds...');
          // Wait for up to 10 seconds for loading to complete
          await new Promise(resolve => {
              const startTime = Date.now();
              const checkLoading = setInterval(() => {
                  const stillLoading = card.querySelector('[class*="LoadingStateLayer_"]');
                  const elapsedTime = Date.now() - startTime;
                  
                  if (!stillLoading) {
                      console.log(`Loading completed after ${elapsedTime/1000} seconds`);
                      clearInterval(checkLoading);
                      resolve();
                  } else if (elapsedTime >= 10000) { // 10 seconds
                      console.log('Loading timed out after 10 seconds');
                      clearInterval(checkLoading);
                      resolve();
                  }
              }, 100);
          });
      }

      const cardData = this.extractCardData(card);
      const wrapper = card.querySelector('[class*="PersonCardContactButtons__Wrapper"]');
      const btnAnchor = wrapper?.querySelector('[class*="Dropdown__AnchorContainer"]');

      if (!btnAnchor) {
          console.log('No email button found after fetch contact loading completed, skipping email extract');
          return cardData;
      }

      btnAnchor.click();
      await this.waitForDropdown();
      await this.extractEmailsFromDropdown(cardData);
      await this.closeDropdown();

      return cardData;
  }

  async waitForDropdown() {
      return new Promise(resolve => {
          const checkDropdown = setInterval(() => {
              const dropdown = document.querySelector('[class*="Dropdown__InternalContainer"]');
              if (dropdown) {
                  clearInterval(checkDropdown);
                  resolve();
              }
          }, 100);
          setTimeout(() => {
              clearInterval(checkDropdown);
              resolve();
          }, 5000);
      });
  }

  async closeDropdown() {
      const dropdownContainer = document.querySelector('[class*="Dropdown__InternalContainer"]');
      const cloneButton = dropdownContainer?.querySelector('.fa-clone');
      
      if (cloneButton && dropdownContainer) {
          cloneButton.click();
          await new Promise(resolve => {
              const checkDropdownClosed = setInterval(() => {
                  const dropdown = document.querySelector('[class*="Dropdown__InternalContainer"]');
                  if (!dropdown) {
                      clearInterval(checkDropdownClosed);
                      resolve();
                  }
              }, 100);
              setTimeout(() => {
                  clearInterval(checkDropdownClosed);
                  resolve();
              }, 5000);
          });
      }
  }

  createExportButton() {
      const exportButton = document.createElement('button');
      exportButton.innerHTML = 'Export to CSV';
      exportButton.style.cssText = 'position: fixed; bottom: 20px; right: 20px; z-index: 9999; padding: 10px 20px; background: #4CAF50; color: white; border: none; border-radius: 4px; cursor: pointer;';
      
      exportButton.addEventListener('click', () => this.exportToCsv());
      document.body.appendChild(exportButton);
  }

  exportToCsv() {
      const headers = [
          'Name', 'Job Title', 'Location', 'Skills', 'Specialties', 'Personal Email', 'Work Email',
          'Current Title', 'Current Company', 'Current Duration', 'Previous Titles', 'Previous Companies',
          'Previous Durations', 'Education Institutions', 'Education Degrees', 'Education Durations'
      ];
      
      const rows = [headers];
      
      this.allExtractedData.forEach(person => {
          const currentRole = person.experience[0] || {};
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
      
      const csvContent = rows.map(row => 
          row.map(cell => `"${(cell || '').toString().replace(/"/g, '""')}"`).join(',')
      ).join('\n');
      
      const csvData = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csvContent);
      const link = document.createElement('a');
      link.setAttribute('href', csvData);
      link.setAttribute('download', 'contacts_export.csv');
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
  }

  async runExtractionWorkflow() {
      const tamResultsContainer = document.querySelector('[data-tour="tam-results"]');
      if (!tamResultsContainer) {
          console.error('No container with data-tour="tam-results" found!');
          return [];
      }

      let hasMorePages = true;

      if (this.paginateOnly) {
          while (hasMorePages) {
              hasMorePages = await this.clickNextPage();
          }
          console.log('Pagination test completed');
          return [];
      }

      while (hasMorePages && (!this.cardLimit || this.allExtractedData.length < this.cardLimit)) {
          const personCards = tamResultsContainer.querySelectorAll('[class^="PersonCardContainer-"]');
          const cardsToProcess = this.cardLimit ? 
              Math.min(this.cardLimit - this.allExtractedData.length, personCards.length) : 
              personCards.length;

          console.log(`Starting contact button clicks for ${cardsToProcess} cards...`);
          for (let i = 0; i < cardsToProcess; i++) {
              const contactButton = personCards[i].querySelector('[class*="PersonCardContactButtons__ContactButtonInner"]');
              if (contactButton) {
                  const baseDelay = 1200;
                  const randomVariation = Math.floor(Math.random() * 111);
                  
                  console.log(`Clicking card ${i + 1}/${cardsToProcess} at ${new Date().toLocaleTimeString()}`);
                  contactButton.dispatchEvent(new MouseEvent('click', {
                      bubbles: true,
                      cancelable: true,
                      view: window
                  }));
                  
                  // Wait before next click
                  await new Promise(resolve => setTimeout(resolve, baseDelay + randomVariation));
              }
          }

          // Process each card
          for (let i = 0; i < cardsToProcess; i++) {
              const cardData = await this.processCard(personCards[i]);
              this.allExtractedData.push(cardData);
          }

          hasMorePages = await this.clickNextPage();
      }

      return this.allExtractedData;
  }

  async execute() {
      ContactExtractor.removeToastNotifications();
      await this.runExtractionWorkflow();
      console.log('Extracted data:', this.allExtractedData);
      this.createExportButton();
      // if we made it this far without error, indicate success
      return true
  }
}

// For console injection, maintain the same interface:
async function extractContactData(cardLimit = null, paginateOnly = false) {
  const extractor = new ContactExtractor(cardLimit, paginateOnly);
  return extractor.execute();
}

// Usage remains the same:
extractContactData();
// extractContactData(3); //// only 3 cards