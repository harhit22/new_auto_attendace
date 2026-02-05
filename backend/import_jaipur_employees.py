import os
import sys
import django
import re

# Setup Django Environment
# Add the project root (backend) to the python path
project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.append(project_root)
sys.path.append(os.getcwd()) # Ensure CWD is also there

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "core.settings")
django.setup()

from core.models import Organization, SaaSEmployee

RAW_DATA = """
1 CIV241 MANNU DABOLIYA Transport Executive
2 CIV242 RAM LAL DOLI Transport Executive
3 CIV243 SONU BAIRWA Transport Executive
4 CIV244 SAWAN KUMAR Transport Executive
5 CIV245 RAVI Transport Executive
6 CIV252 MAHBOOB Transport Executive
7 CIV256 RAMESH Transport Executive
8 CIV258 ANIL Transport Executive
9 CIV261 VISHNU PIWAL Transport Executive
10 CIV262 SHNKER SHAMBHU Transport Executive
11 CIV265 VISHNU LAL HARIJAN Transport Executive
12 CIV281 SATYANARAYANA GOLECHA Transport Executive
13 CIV283 HANSARAJ VERMA Transport Executive
14 CIV286 MEERA BAKSH Transport Executive
15 CIV309 TARA CHAND Transport Executive
16 CIV314 BHARAT KUMAR Transport Executive
17 CIV321 KALU RAM MEENA Transport Executive
18 CIV323 GOLU HARIJAN Transport Executive
19 CIV324 DILIP Transport Executive
20 CIV325 MOHMMAD KADIR Transport Executive
21 CIV328 AJAY DABOLIYA Transport Executive
22 CIV330 DEEPAK Transport Executive
23 CIV331 RAVI SHANKAR Transport Executive
24 CIV332 VINOD KUMAR RAIGAR Transport Executive
25 CIV335 RINKU KUMAR BENIWAL Transport Executive
26 CIV336 JASVANT KUMAR Transport Executive
27 CIV338 JWALA PRASAD Transport Executive
28 CIV339 SUNIL KUMAR Transport Executive
29 CIV341 JAI SINGH Transport Executive
30 CIV344 GIRIRAJ MEENA Transport Executive
31 CIV348 ANIL PANWAR Transport Executive
32 CIV350 NATHU LAL Transport Executive
33 CIV351 SUNIL SARWAN Transport Executive
34 CIV352 AJAY SINGH Transport Executive
35 CIV353 DEEPAK Transport Executive
36 CIV358 BHIMA HARIJAN Transport Executive
37 CIV362 NARENDRA GOLECHHA Transport Executive
38 CIV365 ROHIT UMARWAL Transport Executive
39 CIV366 KRISH Transport Executive
40 CIV367 RAHUL PANCHERWAL Transport Executive
41 CIV368 ASHOK KUMAR Transport Executive
42 CIV373 DHARMENDAR KUMAR HARIJAN Transport Executive
43 CIV378 RAVI KUMAR Transport Executive
44 CIV384 SUNIL HADA Transport Executive
45 CIV391 ASHOK KUMAR Transport Executive
46 CIV399 GANESH DANGORIYA Transport Executive
47 CIV405 GASUDIN KHAN Transport Executive
48 CIV407 VIJAY KUMAR Transport Executive
49 CIV409 SURESH KUMAR Transport Executive
50 CIV416 FOOLCHAND RANAWAT Transport Executive
51 CIV419 VINAY CHAWARIYA Transport Executive
52 CIV420 RAMAVATAR Transport Executive
53 CIV422 SUNIL KUMAR Transport Executive
54 CIV424 MOHIT LAKHAN Transport Executive
55 CIV426 SASHI KAPOOR Transport Executive
56 CIV429 PREMCHAND PAL Transport Executive
57 CIV430 SONU PAL Transport Executive
58 CIV432 SHUBHAM GOYAR Transport Executive
59 CIV434 SAGAR SANGAT Transport Executive
60 CIV436 HEMRAJ Transport Executive
61 CIV442 SURENDRA KUMAR VARMA Transport Executive
62 CIV446 VINOD KUMAR LAKHAN Transport Executive
63 CIV447 SANNI Transport Executive
64 CIV459 VINOD THANWAL Transport Executive
65 CIV466 AJAY KUMAR DHOLI Transport Executive
66 CIV483 LALARAM MEENA Transport Executive
67 CIV486 BADAL Transport Executive
68 CIV489 SONU Transport Executive
69 CIV500 RAHUL DANGORIYA Transport Executive
70 CIV501 OM PRAKASH SAINI Transport Executive
71 CIV502 RAHUL Transport Executive
72 CIV518 SUMID SINGIWAL Transport Executive
73 CIV526 GOURI SHANKAR GOYAR Transport Executive
74 CIV531 SHUBHAM JAJOTAR Transport Executive
75 CIV533 PRAHLAD Transport Executive
76 CIV537 RAHUL LAKHAN Transport Executive
77 CIV538 AKSHYA Transport Executive
78 CIV549 RAJU Transport Executive
79 CIV554 VICKY KUMAR Transport Executive
80 CIV562 INDARJEET PRASAD Transport Executive
81 CIV570 GOURI SHANKAR GOYAR Transport Executive
82 CIV571 JAGDISH KALOSHYA Transport Executive
83 CIV583 ANIL KUMAR TOPIYA Transport Executive
84 CIV590 AJAY LAKHAN Transport Executive
85 CIV603 MONU BALMIK Transport Executive
86 CIV604 HEERA LAL Transport Executive
87 CIV607 SUMIT Transport Executive
88 CIV620 SUNIL Transport Executive
89 CIV621 VIKRAM Transport Executive
90 CIV628 SONU Transport Executive
91 CIV630 DEVISINGH BAIRWA Transport Executive
92 CIV634 DEEPAK Transport Executive
93 CIV639 AMAN KUMAR Transport Executive
94 CIV655 ANIL Transport Executive
95 CIV688 SHYAM LAL HARIJAN Transport Executive
96 CIV692 ASHOK KUMAR Transport Executive
97 CIV702 DILSHAD Transport Executive
98 CIV706 KISHAN Transport Executive
99 CIV712 SONU Transport Executive
100 CIV718 SANDEEP GOYAR Transport Executive
101 CIV720 RAJESH KUMAR Transport Executive
102 CIV726 RAVI Transport Executive
103 CIV728 KAMAL KUMAR PAL Transport Executive
104 CIV729 GHANSHYAM GOLECHHA Transport Executive
105 CIV780 HEMRAJ Transport Executive
106 CIV781 KUNAL Transport Executive
107 CIV783 RAVI KANT SANGELA Transport Executive
108 CIV785 LUCKY Transport Executive
109 CIV787 VISHNU Transport Executive
110 CIV788 PAWAN PACHERWAL Transport Executive
111 CIV791 PRADEEP CHOUHAN Transport Executive
112 CIV793 RITIK NARWAL Transport Executive
113 CIV814 VISHAL Transport Executive
114 CIV823 GHANSHYAM Transport Executive
115 CIV836 SANJYE Transport Executive
116 CIV841 SHANKAR SINGH Transport Executive
117 CIV845 SHOAIB Transport Executive
118 CIV853 ABHISHEK TIMBOLI Transport Executive
119 CIV869 VIJAY Transport Executive
120 CIV875 KAMLESH TANWAR Transport Executive
121 CIV876 LALIT Transport Executive
122 CIV884 KISHAN Transport Executive
123 CIV885 ARUN KUMAR Transport Executive
124 CIV889 DHARAMPAL Transport Executive
125 CIV890 VIVEK JHUNJH Transport Executive
126 CIV894 RAMNARESH Transport Executive
127 CIV897 SAKHOOR MOHMMAD Transport Executive
128 CIV899 DHARMESH (M.P) Transport Executive
129 CIV901 PREAM SINGH (M.P) Transport Executive
130 CIV903 RAHUL (M.P) Transport Executive
131 CIV904 DINESH RAIGAR Transport Executive
132 CIV905 AMIT SAXENA Transport Executive
133 CIV907 RAHUL Transport Executive
134 CIV909 RAJESH KUMAR DHOL Transport Executive
135 CIV920 SUMIT SARSAR Transport Executive
136 CIV921 PARDEEP SANGAT Transport Executive
137 CIV926 ROHIT KUMAR Transport Executive
138 CIV931 SUNNY SARWAN Transport Executive
139 CIV598 DEEPAK PAROCHIYA Service Executive
140 CIV253 RAJESH LAL Service Executive
141 CIV460 VINOD Service Executive
142 CIV617 SANJU KUMAR Service Executive
143 CIV305 MAHENDRA Service Executive
144 CIV411 RAJU HATWAL Service Executive
145 CIV449 UDAY PAL NAT Service Executive
146 CIV829 SHAHA JAMAL Service Executive
147 CIV658 AJAY KUMAR Service Executive
148 CIV317 NARESH Service Executive
149 CIV811 MOH AFSAAR Service Executive
150 CIV259 OMPRAKASH Service Executive
151 CIV856 ABHISHEK Service Executive
152 CIV622 AKASH Service Executive
153 CIV808 SONI Service Executive
154 CIV848 MAMA Service Executive
155 CIV343 BHAIRU Service Executive
156 CIV867 ANNU DEVI Service Executive
157 CIV316 KAMLA DEVI Service Executive
158 CIV877 MANOJ Service Executive
159 CIV408 NEETU Service Executive
160 CIV496 VIMLA HARIJAN Service Executive
161 CIV257 CHANDRAVATI Service Executive
162 CIV872 ARUN KUMAR Service Executive
163 CIV342 DASHRAJ CHANDELIYA Service Executive
164 CIV415 RESHMA KHATUN Service Executive
165 CIV495 RAKESH HARIJAN Service Executive
166 CIV879 DHEERAJ Service Executive
167 CIV854 VINOD Service Executive
168 CIV508 HARSHIT GOLECHA Service Executive
169 CIV843 SUNNY Service Executive
170 CIV807 KALU UMARWAL Service Executive
171 CIV623 SHAKTI Service Executive
172 CIV792 SUNNY Service Executive
173 CIV652 AJAY Service Executive
174 CIV837 GOVINDA Service Executive
175 CIV485 SURAJ Service Executive
176 CIV313 ROHITASH Service Executive
177 CIV406 SHARWAN Service Executive
178 CIV833 MITTHUN Service Executive
179 CIV835 AFSAR ALI Service Executive
180 CIV831 MANOJ Service Executive
181 CIV881 RAVI Service Executive
182 CIV337 GOVIND Service Executive
183 CIV333 HANUMAN Service Executive
184 CIV852 NAKUL Service Executive
185 CIV467 SHIVCHARAN TIMBOLI Service Executive
186 CIV470 LAKHAN LAL Service Executive
187 CIV880 VISHAL Service Executive
188 CIV439 BRAJESH MEENA Service Executive
189 CIV484 RAMNIWAS BAIRWA Service Executive
190 CIV443 PREM PARKASH REGAR Service Executive
191 CIV870 ALIK NINANIYA Service Executive
192 CIV555 KAVEETA Service Executive
193 CIV646 SATYNARAN Service Executive
194 CIV581 SHARDA Service Executive
195 CIV322 DEVANDAR Service Executive
196 CIV423 NARESH VALMIKI Service Executive
197 CIV838 VINOD KUMAR Service Executive
198 CIV609 PRADEEP BALMIK Service Executive
199 CIV400 KAMAL Service Executive
200 CIV418 MAMTA Service Executive
201 CIV550 RAVI KUMAR Service Executive
202 CIV599 SUMIT TANK Service Executive
203 CIV612 JITU Service Executive
204 CIV524 KAMLA Service Executive
205 CIV846 SHAHJAD KHAN Service Executive
206 CIV878 MANISH KUMAR Service Executive
207 CIV643 VICKY Service Executive
208 CIV866 MANJARI Service Executive
209 CIV827 RAVI PARACHE Service Executive
210 CIV694 SONU Service Executive
211 CIV842 RAVI Service Executive
212 CIV264 MUKESH Service Executive
213 CIV887 POOJA Service Executive
214 CIV779 KAVITA LOHARA Service Executive
215 CIV355 SAGAR JAIDIYA Service Executive
216 CIV433 JAIBUN MIRASI Service Executive
217 CIV519 KALA SINGIWAL Service Executive
218 CIV260 SANDHYA Service Executive
219 CIV855 ROHIT Service Executive
220 CIV886 SANJAY KUMAR Service Executive
221 CIV441 AJAY KUMAR LOHRA Service Executive
222 CIV595 SUNNY SARWAN Service Executive
223 CIV653 SHIVAM TIMBOLI Service Executive
224 CIV640 JUGRAJ Service Executive
225 CIV862 DEEPAK Service Executive
226 CIV292 SHYAMLAL BERWA Service Executive
227 CIV732 VIKKI Service Executive
228 CIV597 MOHAN LAL Service Executive
229 CIV873 RAVINA Service Executive
230 CIV888 DEWA Service Executive
231 CIV452 ROHIT CHOUHAN Service Executive
232 CIV891 DAKSH Service Executive
233 CIV892 KARAN DIKIYA Service Executive
234 CIV575 MOHAN LAL Service Executive
235 CIV431 RESHMA PAL Service Executive
236 CIV558 NATHU RAM Service Executive
237 CIV425 VIKRAM UMARWAL Service Executive
238 CIV839 RAHUL Service Executive
239 CIV797 MOHD KAIF Service Executive
240 CIV307 ANIL Service Executive
241 CIV893 BIJALI KHATUN Service Executive
242 CIV895 JAHIR Service Executive
243 CIV769 DHARMA Service Executive
244 CIV776 DEEP CHAND Service Executive
245 CIV778 KAVI KUMAR Service Executive
246 CIV329 SACHIN BAIRWA Service Executive
247 CIV896 PRAKASH GODIWAL Service Executive
248 CIV775 HARIOM Service Executive
249 CIV900 ALIYASH(M.P) Service Executive
250 CIV902 SARWAN (M.P) Service Executive
251 CIV906 RAKESH HARIJAN Service Executive
252 CIV709 RAHKI Service Executive
253 CIV908 SIMUN SINGAD Service Executive
254 CIV644 MAHAVIR SARASAR Service Executive
255 CIV911 JAI KISHAN Service Executive
256 CIV914 ALOK Service Executive
257 CIV912 DEEPU HARIJAN Service Executive
258 CIV913 AJAY SINGH Service Executive
259 CIV910 MADHU Service Executive
260 CIV613 VISHAL PANWAR Service Executive
261 CIV764 GIGGLI Service Executive
262 CIV532 VIKRAM HARI Service Executive
263 CIV915 VINOD Service Executive
264 CIV922 JIYA LAL Service Executive
265 CIV916 CHOTE LAL Service Executive
266 CIV919 RAJ KUMAR Service Executive
267 CIV917 KALU Service Executive
268 CIV918 VISHNU Service Executive
269 CIV927 BANTI TAJI Service Executive
270 CIV925 DEV KANT Service Executive
271 CIV924 AMAR Service Executive
272 CIV928 ANAND KUMAR Service Executive
273 CIV929 SOHAN Service Executive
274 CIV930 SANNI Service Executive
275 CIV934 RAJAT Service Executive
276 CIV933 RAVI KUMAR Service Executive
277 CIV469 SANTOSH LAL Service Executive
278 CIV936 RITIK KUMAR Service Executive
279 CIV932 VIJENDRA DANGORIYA Service Executive
280 CIV937 JITENDRA Service Executive
281 CIV923 VINOD KHERALIYA Service Executive
"""

def split_name(name):
    parts = name.strip().split()
    if not parts:
        return 'Unknown', ''
    if len(parts) == 1:
        return parts[0], ''
    return parts[0], ' '.join(parts[1:])

def run():
    print("Starting import...")
    
    # 1. Find Jaipur Organization
    # Try different search terms
    try:
        org = Organization.objects.filter(name__icontains='Jaipur').first()
        if not org:
            org = Organization.objects.filter(name__icontains='Siker').first() # Fallback? No, user said Jaipur
            
        if not org:
            print("ERROR: Could not find 'Jaipur' organization.")
            print("Available Organizations:")
            for o in Organization.objects.all():
                print(f"- {o.name} ({o.org_code})")
            return
            
        print(f"Target Organization: {org.name} ({org.org_code})")
        
    except Exception as e:
        print(f"Error finding organization: {e}")
        return

    # 2. Parse Data
    lines = RAW_DATA.strip().split('\n')
    count = 0
    updated = 0
    created = 0
    
    for line in lines:
        if not line.strip():
            continue
            
        # Regex to parse: {SNo} {EmpCode} {Name} {Designation}
        # Designation is at the end: "Transport Executive" or "Service Executive"
        
        designation = None
        role = 'driver'
        
        if 'Transport Executive' in line:
            designation = 'Transport Executive'
            role = 'driver'
        elif 'Service Executive' in line:
            designation = 'Service Executive'
            role = 'helper'
        else:
            print(f"SKIPPING: Could not identify designation in line: {line}")
            continue
            
        # Remove designation from line to parse name/code
        remainder = line.replace(designation, '').strip()
        
        # Parse SNo and EmpCode
        # Example remainder: "1 CIV241 MANNU DABOLIYA"
        parts = remainder.split()
        if len(parts) < 3:
            print(f"SKIPPING: Invalid format: {line}")
            continue
            
        s_no = parts[0]
        emp_code = parts[1]
        full_name = ' '.join(parts[2:])
        
        first_name, last_name = split_name(full_name)
        
        # 3. Create/Update Employee
        emp, created_bool = SaaSEmployee.objects.get_or_create(
            organization=org,
            employee_id=emp_code,
            defaults={
                'first_name': first_name,
                'last_name': last_name,
                'designation': designation,
                'role': role,
                'department': 'Operations'
            }
        )
        
        if created_bool:
            created += 1
            print(f"CREATED: {emp_code} - {full_name}")
        else:
            # Update fields if existing
            emp.first_name = first_name
            emp.last_name = last_name
            emp.designation = designation
            emp.role = role
            emp.save()
            updated += 1
            # print(f"UPDATED: {emp_code} - {full_name}")
            
        count += 1
        
    print(f"\nIMPORT COMPLETE.")
    print(f"Total Processed: {count}")
    print(f"Created: {created}")
    print(f"Updated: {updated}")

if __name__ == "__main__":
    run()
