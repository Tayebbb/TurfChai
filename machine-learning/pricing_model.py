import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestRegressor
from skl2onnx import convert_sklearn
from skl2onnx.common.data_types import FloatTensorType

# 1. Load the data from your CSV file
csv_filename = "turf_pricing_dataset.csv"
df = pd.read_csv(csv_filename)

# 2. Feature Engineering: Create a pure time-based slot
# 0-15 (Midnight to 3:59 PM) = Low Demand
# 16-24 (4:00 PM to Midnight) = High Demand
def categorize_time(hour):
    if 0 <= hour <= 15:
        return 0
    else:
        return 1

# Apply the function to create the new column
df['timeSlot'] = df['hour'].apply(categorize_time)

# 3. Separate Features (X) and Target (y)
# The exact 9 features the model now expects
feature_columns = [
    'day', 'month', 'hour', 'weekend', 'publicHoliday', 
    'daysBeforeBooking', 'weatherCondition', 'occupancyRate', 
    'timeSlot'
]

# Extract features and convert to float32 (required by ONNX)
X_train = df[feature_columns].values.astype(np.float32)

# Extract the target multiplier (the label the AI needs to predict)
y_train = df['target_multiplier'].values.astype(np.float32)

print(f"Loaded {len(df)} rows from {csv_filename}")

# 4. Initialize and Train the Random Forest Model
# n_estimators=100 means 100 decision trees in the forest
model = RandomForestRegressor(n_estimators=100, random_state=42)
model.fit(X_train, y_train)

print(f"Model Training Complete. Score (R^2): {model.score(X_train, y_train):.2f}")

# 5. Export the Model to ONNX format
# We define the input tensor shape: [None, 9] means any batch size, exactly 9 features
initial_type = [('float_input', FloatTensorType([None, 9]))]
onnx_model = convert_sklearn(model, initial_types=initial_type)

# 6. Save the .onnx file
output_filename = "pricing_model.onnx"
with open(output_filename, "wb") as f:
    f.write(onnx_model.SerializeToString())

print(f"Model exported successfully to '{output_filename}'.")
print("Make sure your Spring Boot input tensor passes exactly 9 features in the exact same order.")