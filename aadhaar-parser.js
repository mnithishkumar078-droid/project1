// aadhaar-parser.js
class AadhaarXMLParser {
    constructor(xmlContent) {
        this.xmlContent = xmlContent;
        this.parser = new DOMParser();
        this.xmlDoc = this.parser.parseFromString(xmlContent, "text/xml");
        this.data = {};
    }

    parseXML() {
        try {
            const root = this.xmlDoc.documentElement;
            this.data.reference_id = root.getAttribute('referenceId');
            
            const uidData = root.querySelector('UidData');
            
            if (uidData) {
                const poi = uidData.querySelector('Poi');
                if (poi) {
                    this.data.personal_details = {
                        name: poi.getAttribute('name'),
                        dob: poi.getAttribute('dob'),
                        gender: poi.getAttribute('gender'),
                        dob_matching_score: poi.getAttribute('m')
                    };
                }
                
                const poa = uidData.querySelector('Poa');
                if (poa) {
                    this.data.address_details = {
                        care_of: poa.getAttribute('careof'),
                        house: poa.getAttribute('house'),
                        street: poa.getAttribute('street'),
                        landmark: poa.getAttribute('landmark'),
                        locality: poa.getAttribute('loc'),
                        village_town_city: poa.getAttribute('vtc'),
                        post_office: poa.getAttribute('po'),
                        sub_district: poa.getAttribute('subdist'),
                        district: poa.getAttribute('dist'),
                        state: poa.getAttribute('state'),
                        country: poa.getAttribute('country'),
                        pincode: poa.getAttribute('pc')
                    };
                }
                
                const pht = uidData.querySelector('Pht');
                if (pht && pht.textContent) {
                    this.data.photo_base64 = pht.textContent;
                }
            }
            
            return this.data;
        } catch (error) {
            console.error('Error parsing XML:', error);
            throw error;
        }
    }

    formatAddress() {
        if (!this.data.address_details) return 'N/A';
        
        const ad = this.data.address_details;
        const parts = [];
        
        if (ad.house) parts.push(ad.house);
        if (ad.street) parts.push(ad.street);
        if (ad.landmark) parts.push(`near ${ad.landmark}`);
        if (ad.locality) parts.push(ad.locality);
        if (ad.village_town_city) parts.push(ad.village_town_city);
        if (ad.district) parts.push(ad.district);
        if (ad.state) parts.push(ad.state);
        if (ad.pincode) parts.push(ad.pincode);
        
        return parts.join(', ');
    }

    formatDate(dobString) {
        if (!dobString) return 'N/A';
        try {
            const parts = dobString.split('-');
            if (parts.length === 3) {
                const date = new Date(parts[2], parts[1] - 1, parts[0]);
                return date.toLocaleDateString('en-IN', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric'
                });
            }
            return dobString;
        } catch {
            return dobString;
        }
    }

    getSummary() {
        const summary = {};
        
        if (this.data.personal_details) {
            summary.name = this.data.personal_details.name || 'N/A';
            summary.dob = this.formatDate(this.data.personal_details.dob);
            summary.gender = this.data.personal_details.gender || 'N/A';
        }
        
        summary.address = this.formatAddress();
        summary.reference_id = this.data.reference_id || 'N/A';
        summary.has_photo = !!this.data.photo_base64;
        
        return summary;
    }
}