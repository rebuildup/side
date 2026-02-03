export const StatusMessage = ({ message }) => {
    if (!message)
        return null;
    return (<div className="status-float" role="status">
      {message}
    </div>);
};
