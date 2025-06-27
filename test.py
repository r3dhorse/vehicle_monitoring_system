import pandas as pd
import random
import string
from datetime import datetime

# Configuration
RECORD_COUNT = 10000
OUTPUT_FILENAME = f"vehicle_records_{datetime.now().strftime('%Y%m%d_%H%M%S')}.xlsx"

# Data pools
MAKES_MODELS = [
    "Toyota Camry", "Honda Civic", "Ford F-150", "Chevrolet Express", 
    "Tesla Model 3", "Honda PCX", "Nissan Altima", "Jeep Wrangler",
    "BMW 330i", "Mercedes C-Class", "Hyundai Sonata", "Kia Sportage"
]
COLORS = ["White", "Black", "Silver", "Blue", "Red", "Gray", "Green"]
DEPARTMENTS = [
    "IT Department", "HR Department", "Operations", "Logistics", 
    "Executive", "Finance", "Marketing", "Sales", "Security"
]
VEHICLE_TYPES = ["Car", "Truck", "Van", "SUV", "Motorcycle"]
STATUSES = ["IN", "OUT"]
ACCESS_STATUSES = ["Access", "No Access", "Banned"]
DRIVERS = [f"DRV{str(i).zfill(3)}" for i in range(1, 501)] + ["Alex", "Jamie", "Taylor", "Jordan", "Casey"]

# Generate unique plate numbers
def generate_plate():
    format_type = random.choice([0, 1])
    if format_type == 0:  # ABC-123 format
        letters = ''.join(random.choices(string.ascii_uppercase, k=3))
    else:  # MC-112 format
        letters = ''.join(random.choices(string.ascii_uppercase, k=2))
    numbers = ''.join(random.choices(string.digits, k=3))
    return f"{letters}-{numbers}"

plate_numbers = set()
while len(plate_numbers) < RECORD_COUNT:
    plate_numbers.add(generate_plate())
plate_numbers = list(plate_numbers)

# Generate data
data = []
for i in range(RECORD_COUNT):
    assigned_drivers = random.sample(DRIVERS, random.randint(1, 3))
    current_driver = random.choice(assigned_drivers) if random.random() > 0.1 else ""
    
    data.append({
        "Plate Number": plate_numbers[i],
        "Make/Model": random.choice(MAKES_MODELS),
        "Color": random.choice(COLORS),
        "Department/Company": random.choice(DEPARTMENTS),
        "Year": random.randint(2010, 2023),
        "Type": random.choice(VEHICLE_TYPES),
        "Status": random.choice(STATUSES),
        "Current Driver": current_driver,
        "Assigned Drivers": ",".join(assigned_drivers),
        "Access Status": random.choice(ACCESS_STATUSES)
    })

# Create DataFrame and save to Excel
df = pd.DataFrame(data)
df.to_excel(OUTPUT_FILENAME, index=False)
print(f"Generated {RECORD_COUNT} records in '{OUTPUT_FILENAME}'")