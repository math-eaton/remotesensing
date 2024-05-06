import pandas as pd
import os
import json 

def load_data(file_path):
    """
    Load data from a given file path, determining if it's JSON or CSV.
    
    Parameters:
    file_path (str): The path to the input file.
    
    Returns:
    pd.DataFrame: A pandas DataFrame containing the data from the input file.
    """
    file_extension = os.path.splitext(file_path)[1].lower()
    if file_extension == '.json':
        with open(file_path) as f:
            data = json.load(f)
        return pd.DataFrame(data)
    elif file_extension == '.csv':
        return pd.read_csv(file_path)
    else:
        raise ValueError(f'Unsupported file format: {file_extension}')


def preprocess_join_field(df, join_field):
    """
    Ensure join field exists and preprocess its values by stripping any leading or trailing whitespace.
    
    Parameters:
    df (pd.DataFrame): The DataFrame to process.
    join_field (str): The name of the field to preprocess.
    
    Returns:
    pd.DataFrame: The processed DataFrame with whitespace-trimmed join field values.
    """
    if join_field in df.columns:
        # Strip leading/trailing whitespace from the join field values
        df[join_field] = df[join_field].str.strip()
    else:
        print(f"Warning: '{join_field}' not found in DataFrame.")
    return df

def join_datasets(file_path_1, file_path_2, join_field, output_path, output_format='json'):
    """
    Join two datasets based on a join field and save the output.
    
    Parameters:
    file_path_1 (str): The path to the first input file.
    file_path_2 (str): The path to the second input file.
    join_field (str): The name of the field to join on.
    output_path (str): The path to save the joined dataset.
    output_format (str): The format to save the joined dataset ('csv' or 'json').
    """
    # Load the datasets
    df1 = load_data(file_path_1)
    df2 = load_data(file_path_2)



    # Preprocess the join field in both DataFrames
    df1 = preprocess_join_field(df1, join_field)
    df2 = preprocess_join_field(df2, join_field)

    print(df1['lms_application_id'].head())
    print(df2['lms_application_id'].head())

    
    # Perform an inner join on the join field
    joined_df = pd.merge(df1, df2, on=join_field, how='inner')
    
    # Save the joined DataFrame to the specified output format
    if output_format == 'csv':
        joined_df.to_csv(output_path, index=False)
    elif output_format == 'json':
        joined_df.to_json(output_path, orient='records')
    else:
        raise ValueError(f'Unsupported output format: {output_format}')
    
file_path_1 = 'src/assets/data/fcc/fm/processed/FM_service_contour_downsample8_20240319.json'  # Change to your file path
file_path_2 = 'src/assets/data/fcc/fm/processed/fm_info_cleaned.csv'  # Change to your file path
join_field = 'lms_application_id'  # The field name to join on
output_path = 'src/assets/data/fcc/fm/processed/FM_service_contour_downsample8_FMinfoJoin_20240319.json'  # The output file path
output_format = 'json'  # Change to 'json' if you want JSON output


join_datasets(file_path_1, file_path_2, join_field, output_path, output_format)
