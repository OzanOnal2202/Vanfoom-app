-- Add new workflow status 'wacht_op_onderdelen' to the enum
ALTER TYPE bike_workflow_status ADD VALUE 'wacht_op_onderdelen' AFTER 'wacht_op_akkoord';