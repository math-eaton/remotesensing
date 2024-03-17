
import pandas as pd
import os

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
        return pd.read_json(file_path)
    elif file_extension == '.csv':
        return pd.read_csv(file_path)
    else:
        raise ValueError(f'Unsupported file format: {file_extension}')

def join_datasets(file_path_1, file_path_2, join_field, output_path, output_format='csv'):
    """
    Join two datasets based on a join field and save the output.
    
    Parameters:
    file_path_1 (str): The path to the first input file.
    file_path_2 (str): The path to the second input file.
    join_field (str): The name of the field to join on.
    output_path (str): The path to save the joined dataset.
    output_format (str): The format to save the joined dataset ('csv' or 'json').
    """
    df1 = load_data(file_path_1)
    df2 = load_data(file_path_2)
    
    # Perform an inner join on the join field
    joined_df = pd.merge(df1, df2, on=join_field, how='inner')
    
    # Save the joined DataFrame to the specified output format
    if output_format == 'csv':
        joined_df.to_csv(output_path, index=False)
    elif output_format == 'json':
        joined_df.to_json(output_path, orient='records')
    else:
        raise ValueError(f'Unsupported output format: {output_format}')

# Example usage
file_path_1 = 'src/assets/data/fcc/fm/processed/FM_contours_AOI_hubSpokes_processed.geojson'  # Change to your file path
file_path_2 = 'src/assets/data/fcc/fm/processed/fm_info_cleaned.csv'  # Change to your file path
join_field = 'lms_application_id'  # The field name to join on
output_path = 'joined_output.csv'  # The output file path
output_format = 'csv'  # Change to 'json' if you want JSON output

# Uncomment the line below to run the example with your file paths and preferences
# join_datasets(file_path_1, file_path_2, join_field, output_path, output_format)
